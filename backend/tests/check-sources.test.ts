// ============================================================
// Tests du contrôle des liens sources. Aucun réseau : le fetch est injecté.
// ============================================================

import { describe, it, expect } from 'vitest';
import { EMBEDDED_AIDES, EMBEDDED_IDCC, EMBEDDED_NAF, EMBEDDED_OPCOS, EMBEDDED_PORTAILS } from '@opco/core';
import type { Aide, IdccTable, OpcoData, PortailRegional } from '@opco/core';
import { classerStatut, collecterUrls, motifIgnore, rapportMarkdown, verifierUrls } from '../src/check-sources';
import type { ResultatLien } from '../src/check-sources';

/** U+2014, construit par son code : le tiret cadratin ne figure pas dans ce fichier (charte SFG). */
const TIRET_CADRATIN = String.fromCharCode(0x2014);
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

const vide = { opcos: [] as OpcoData[], aides: [] as Aide[], portails: [] as PortailRegional[], idcc: {} as IdccTable };

const attendre = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const reponse = (statut: number) => new Response(null, { status: statut });

describe('collecterUrls', () => {
  it('collecte les URL sans doublon, avec leurs usages', () => {
    const urls = collecterUrls({ opcos: EMBEDDED_OPCOS, aides: EMBEDDED_AIDES, portails: EMBEDDED_PORTAILS, idcc: EMBEDDED_IDCC });
    expect(urls.size).toBeGreaterThan(10);
    for (const [url, usages] of urls) {
      expect(url).toMatch(/^https?:\/\//);
      expect(usages.length).toBeGreaterThan(0);
      expect(new Set(usages).size).toBe(usages.length);
    }
  });

  it('retrouve toutes les adresses des données embarquées, y compris les sources des variantes, des alertes et de la table IDCC', () => {
    const urls = collecterUrls({
      opcos: EMBEDDED_OPCOS,
      aides: EMBEDDED_AIDES,
      portails: EMBEDDED_PORTAILS,
      idcc: EMBEDDED_IDCC,
      naf: EMBEDDED_NAF,
    });
    const attendues: string[] = [
      ...EMBEDDED_OPCOS.flatMap((o) => [
        o.url_finance_page,
        o.cout_horaire_inter.source_url,
        o.budget_annuel_max.source_url,
        ...(o.dispositifs_complementaires ?? []).map((d) => d.source_url),
        ...(o.variantes_branche ?? []).map((v) => v.source_url),
        ...(o.alertes ?? []).map((a) => a.source_url),
      ]),
      ...EMBEDDED_AIDES.flatMap((a) => [
        ...(a.url_demarche ? [a.url_demarche] : []),
        ...a.sources.map((s) => s.url),
        ...Object.values(a.liens_par_region ?? {}),
      ]),
      ...EMBEDDED_PORTAILS.flatMap((p) => p.liens.map((l) => l.url)),
      ...Object.values(EMBEDDED_IDCC).map((e) => e.source),
      ...EMBEDDED_NAF.map((n) => n.source),
    ].filter((u) => /^https?:\/\//.test(u));
    expect(attendues.length).toBeGreaterThan(100);
    const manquantes = attendues.filter((u) => !urls.has(u));
    expect(manquantes).toEqual([]);
  });

  it('repère les adresses imbriquées et celles écrites dans un texte, avec un usage lisible', () => {
    const opco = {
      slug: 'demo',
      url_finance_page: 'https://demo.fr/financer',
      cout_horaire_inter: { value: 25, confidence: 'exact', source_url: 'https://demo.fr/criteres' },
      secteurs_source: 'https://demo.fr/secteurs',
      alertes: [{ type: 'fonds_epuises', source_url: 'https://demo.fr/alerte' }],
      variantes_branche: [{ id: 'gros', source_url: 'https://demo.fr/gros', budget_annuel_max: { value: 1, source_url: 'https://demo.fr/gros-budget' } }],
      cpf_details: { description: 'abondement', source_url: 'https://demo.fr/cpf' },
      sources: ['https://demo.fr/liste-1', 'https://demo.fr/liste-2'],
    } as unknown as OpcoData;
    const aide = {
      id: 'nat-demo',
      url_demarche: 'https://aide.gouv.fr/demarche',
      liens_par_region: { '11': 'https://aide.gouv.fr/idf' },
      sources: [{ url: 'https://aide.gouv.fr/source', titre: 'Source', extrait: 'texte' }],
      conditions: ['Plafonds de votre profession : https://aide.gouv.fr/plafonds'],
    } as unknown as Aide;
    const portail = { region: '11', liens: [{ titre: 'Région', url: 'https://region.fr/', type: 'region' }] } as unknown as PortailRegional;
    const idcc = {
      '0016': { idcc: '0016', titre: 'Transports', opco: 'opco-mobilites', statut: 'actif', note: 'Confirmé par le site (https://demo.fr/branche).', source: 'https://legi.gouv.fr/arrete' },
    } as unknown as IdccTable;

    const urls = collecterUrls({ opcos: [opco], aides: [aide], portails: [portail], idcc, naf: [{ prefixe: '47', opco: 'opcommerce', part: null, libelle: 'Commerce', source: 'https://demo.fr/naf' }] });

    expect(urls.get('https://demo.fr/financer')).toEqual(['opco:demo.url_finance_page']);
    expect(urls.get('https://demo.fr/criteres')).toEqual(['opco:demo.cout_horaire_inter']);
    expect(urls.get('https://demo.fr/secteurs')).toEqual(['opco:demo.secteurs_source']);
    expect(urls.get('https://demo.fr/alerte')).toEqual(['opco:demo.alertes[0]']);
    expect(urls.get('https://demo.fr/gros')).toEqual(['opco:demo.variantes_branche[gros]']);
    expect(urls.get('https://demo.fr/gros-budget')).toEqual(['opco:demo.variantes_branche[gros].budget_annuel_max']);
    expect(urls.get('https://demo.fr/cpf')).toEqual(['opco:demo.cpf_details']);
    expect(urls.get('https://demo.fr/liste-2')).toEqual(['opco:demo.sources[1]']);
    expect(urls.get('https://aide.gouv.fr/demarche')).toEqual(['aide:nat-demo.url_demarche']);
    expect(urls.get('https://aide.gouv.fr/idf')).toEqual(['aide:nat-demo.liens_par_region.11']);
    expect(urls.get('https://aide.gouv.fr/source')).toEqual(['aide:nat-demo.sources[0].url']);
    expect(urls.get('https://aide.gouv.fr/plafonds')).toEqual(['aide:nat-demo.conditions[0]']);
    expect(urls.get('https://region.fr/')).toEqual(['portail:11.liens[0].url']);
    expect(urls.get('https://legi.gouv.fr/arrete')).toEqual(['idcc:0016.source']);
    expect(urls.get('https://demo.fr/branche')).toEqual(['idcc:0016.note']);
    expect(urls.get('https://demo.fr/naf')).toEqual(['naf:47.source']);
  });

  it("regroupe les usages d'une adresse partagée, sans doublon, et ignore ce qui n'est pas une adresse web", () => {
    const idcc = {
      '0001': { idcc: '0001', titre: 'A', opco: 'akto', statut: 'actif', source: 'https://legi.gouv.fr/arrete', note: 'voir https://legi.gouv.fr/arrete' },
      '0002': { idcc: '0002', titre: 'B', opco: 'akto', statut: 'actif', source: 'https://legi.gouv.fr/arrete' },
      '0003': { idcc: '0003', titre: 'C', opco: 'akto', statut: 'actif', source: 'mailto:contact@demo.fr', note: 'aucune adresse ici, https:// non plus' },
      '0004': { idcc: '0004', titre: 'D', opco: 'akto', statut: 'actif', source: '' },
    } as unknown as IdccTable;
    const urls = collecterUrls({ ...vide, idcc });
    expect([...urls.keys()]).toEqual(['https://legi.gouv.fr/arrete']);
    expect(urls.get('https://legi.gouv.fr/arrete')).toEqual(['idcc:0001.source', 'idcc:0001.note', 'idcc:0002.source']);
  });

  it("ne déclare qu'une fois un usage quand le même texte cite deux fois la même adresse", () => {
    const idcc = {
      '0001': { idcc: '0001', titre: 'A', opco: 'akto', statut: 'actif', note: 'Voir https://a.fr/x puis (source : https://a.fr/x).', source: 'https://legi.gouv.fr/arrete' },
    } as unknown as IdccTable;
    const urls = collecterUrls({ ...vide, idcc });
    expect(urls.get('https://a.fr/x')).toEqual(['idcc:0001.note']);
  });

  it('ne garde pas la ponctuation qui suit une adresse écrite dans une phrase', () => {
    const idcc = {
      '0001': {
        idcc: '0001',
        titre: 'A',
        opco: 'akto',
        statut: 'actif',
        note: 'Confirmé par le site officiel (https://a.fr/liste.pdf). Rattachement (source : https://b.fr/page/), puis https://c.fr/x; fin « https://d.fr/y ».',
        source: 'https://legi.gouv.fr/arrete',
      },
    } as unknown as IdccTable;
    const urls = collecterUrls({ ...vide, idcc });
    expect([...urls.keys()].sort()).toEqual(['https://a.fr/liste.pdf', 'https://b.fr/page/', 'https://c.fr/x', 'https://d.fr/y', 'https://legi.gouv.fr/arrete']);
  });
});

describe('classerStatut', () => {
  it('classe les statuts HTTP', () => {
    expect(classerStatut(200)).toBe('ok');
    expect(classerStatut(301)).toBe('ok');
    expect(classerStatut(403)).toBe('a_verifier');
    expect(classerStatut(429)).toBe('a_verifier');
    expect(classerStatut(404)).toBe('casse');
    expect(classerStatut(null)).toBe('casse');
  });

  it('traite les bornes : 399 ok, 400 cassé, 401 et 503 à vérifier, 410 et 5xx cassés', () => {
    expect(classerStatut(399)).toBe('ok');
    expect(classerStatut(400)).toBe('casse');
    expect(classerStatut(401)).toBe('a_verifier');
    expect(classerStatut(410)).toBe('casse');
    expect(classerStatut(500)).toBe('casse');
    expect(classerStatut(502)).toBe('casse');
    expect(classerStatut(503)).toBe('a_verifier');
  });
});

describe('motifIgnore (licence France compétences)', () => {
  it("écarte l'API de France compétences, quelle que soit la casse, et donne le motif", () => {
    expect(motifIgnore('https://api.francecompetences.fr/referentiels/x')).toMatch(/R\. 6123-35/);
    expect(motifIgnore('https://API.FranceCompetences.fr/')).toMatch(/licence/i);
    expect(motifIgnore('http://api.francecompetences.fr:8443/x')).not.toBeNull();
  });

  // Chaque écriture ci-dessous est envoyée par le client HTTP au serveur api.francecompetences.fr.
  it.each([
    ['point final (nom de domaine complet)', 'https://api.francecompetences.fr./referentiels/x'],
    ['point final en majuscules', 'https://API.FRANCECOMPETENCES.FR./x'],
    ['plusieurs points finaux', 'https://api.francecompetences.fr../x'],
    ['point final codé %2E', 'https://api.francecompetences.fr%2E/x'],
    ['point intérieur codé %2E', 'https://api.francecompetences%2Efr/x'],
    ['point idéographique U+3002', 'https://api。francecompetences。fr/x'],
    ['lettres pleine chasse', 'https://ａｐｉ.francecompetences.fr/x'],
    ['schéma en majuscules', 'HTTPS://api.francecompetences.fr/x'],
    ['port 443 explicite', 'https://api.francecompetences.fr:443/x'],
    ['identifiants devant le nom', 'https://utilisateur:secret@api.francecompetences.fr/x'],
    ['barre oblique inverse après le nom', 'https://api.francecompetences.fr\\@exemple.fr/x'],
    ['sous-domaine', 'https://v2.api.francecompetences.fr/x'],
    ['sous-domaine en majuscules avec point final', 'https://V2.API.francecompetences.fr./x'],
  ])("écarte l'adresse écrite avec %s", (_forme, url) => {
    expect(motifIgnore(url)).toMatch(/R\. 6123-35/);
  });

  it.each([
    ["un nom de domaine qui commence par l'hôte interdit", 'https://api.francecompetences.fr.exemple.fr/x'],
    ['un sous-domaine voisin dont le nom se termine pareil', 'https://notapi.francecompetences.fr/x'],
    ["l'hôte interdit placé devant @ (c'est un identifiant, l'hôte réel est exemple.fr)", 'https://api.francecompetences.fr@exemple.fr/x'],
    ["l'hôte interdit cité dans le chemin ou la requête", 'https://exemple.fr/api.francecompetences.fr?site=api.francecompetences.fr'],
    ['le domaine parent', 'https://francecompetences.fr/'],
    ["le site web de l'organisme", 'https://www.francecompetences.fr/reguler-le-marche/mon-cep/'],
    ["l'outil officiel « Quel est mon OPCO »", 'https://quel-est-mon-opco.francecompetences.fr/'],
  ])('laisse passer %s', (_cas, url) => {
    expect(motifIgnore(url)).toBeNull();
  });

  it("laisse passer les pages web ordinaires, dont celle de l'outil officiel, et les adresses illisibles", () => {
    expect(motifIgnore('https://quel-est-mon-opco.francecompetences.fr/')).toBeNull();
    expect(motifIgnore('https://www.francecompetences.fr/reguler-le-marche/mon-cep/')).toBeNull();
    expect(motifIgnore('https://exemple.fr/api.francecompetences.fr')).toBeNull();
    expect(motifIgnore('pas une adresse')).toBeNull();
  });

  it("ne confond pas un hôte nommé comme une propriété d'objet (constructor, __proto__) avec un hôte interdit", () => {
    expect(motifIgnore('http://constructor/x')).toBeNull();
    expect(motifIgnore('http://__proto__/x')).toBeNull();
  });
});

describe('verifierUrls', () => {
  it('vérifie les URL avec un fetch injecté', async () => {
    const faux = (async (url: string) => new Response(null, { status: url.includes('mort') ? 404 : 200 })) as unknown as typeof fetch;
    const r = await verifierUrls(new Map([['https://ok.fr', ['a']], ['https://mort.fr', ['b']]]), { fetchImpl: faux, concurrence: 2 });
    expect(r.find((x) => x.url === 'https://ok.fr')?.etat).toBe('ok');
    expect(r.find((x) => x.url === 'https://mort.fr')?.etat).toBe('casse');
    expect(r.find((x) => x.url === 'https://mort.fr')?.statut).toBe(404);
    expect(r.find((x) => x.url === 'https://mort.fr')?.utilisePar).toEqual(['b']);
  });

  it('classe un refus anti-robots en « à vérifier » et interroge en GET avec un User-Agent identifiable', async () => {
    const requetes: { url: string; methode?: string; agent?: string }[] = [];
    const faux = (async (url: string, init?: RequestInit) => {
      requetes.push({ url, methode: init?.method, agent: (init?.headers as Record<string, string>)?.['User-Agent'] });
      return reponse(403);
    }) as unknown as typeof fetch;
    const [r] = await verifierUrls(new Map([['https://protege.fr/page', ['x']]]), { fetchImpl: faux });
    expect(r.etat).toBe('a_verifier');
    expect(r.statut).toBe(403);
    expect(requetes).toEqual([{ url: 'https://protege.fr/page', methode: 'GET', agent: expect.stringContaining('financement-opco') }]);
  });

  it("ne contacte jamais api.francecompetences.fr (licence) et le signale comme ignoré ; une page web ordinaire reste vérifiée", async () => {
    const appels: string[] = [];
    const faux = (async (url: string) => {
      appels.push(url);
      return reponse(200);
    }) as unknown as typeof fetch;
    const urls = new Map<string, string[]>([
      ['https://api.francecompetences.fr/referentiels/tables', ['idcc:0001.source']],
      ['https://API.francecompetences.fr/autre', ['aide:nat-x.sources[0].url']],
      ['https://www.francecompetences.fr/reguler-le-marche/mon-cep/', ['aide:nat-cep.sources[0].url']],
    ]);
    const r = await verifierUrls(urls, { fetchImpl: faux });

    expect(appels).toEqual(['https://www.francecompetences.fr/reguler-le-marche/mon-cep/']);
    expect(r.map((x) => x.etat)).toEqual(['ignore', 'ignore', 'ok']);
    expect(r[0]).toMatchObject({ url: 'https://api.francecompetences.fr/referentiels/tables', statut: null, utilisePar: ['idcc:0001.source'] });
    expect(r[0].motif).toMatch(/R\. 6123-35/);
    expect(r[0].erreur).toBeUndefined();
  });

  it('ne contacte jamais api.francecompetences.fr écrit avec un point final, %2E ou un sous-domaine, mais contacte les adresses voisines', async () => {
    const appels: string[] = [];
    const faux = (async (url: string) => {
      appels.push(url);
      return reponse(200);
    }) as unknown as typeof fetch;
    const interdites = ['https://api.francecompetences.fr./referentiels/tables', 'https://api.francecompetences.fr%2E/referentiels/tables', 'https://V2.API.francecompetences.fr./x'];
    const voisines = ['https://notapi.francecompetences.fr/x', 'https://api.francecompetences.fr.exemple.fr/x'];
    const r = await verifierUrls(new Map([...interdites, ...voisines].map((u) => [u, ['x']])), { fetchImpl: faux });

    expect([...appels].sort()).toEqual([...voisines].sort());
    expect(r.map((x) => x.etat)).toEqual(['ignore', 'ignore', 'ignore', 'ok', 'ok']);
    for (const x of r.slice(0, 3)) expect(x.motif).toMatch(/R\. 6123-35/);
  });

  it("contacte normalement un hôte nommé comme une propriété d'objet (constructor, __proto__) au lieu de le déclarer ignoré", async () => {
    const appels: string[] = [];
    const faux = (async (url: string) => {
      appels.push(url);
      return reponse(200);
    }) as unknown as typeof fetch;
    const r = await verifierUrls(new Map([['http://constructor/x', ['a']], ['http://__proto__/x', ['b']]]), { fetchImpl: faux });
    expect([...appels].sort()).toEqual(['http://__proto__/x', 'http://constructor/x']);
    expect(r.map((x) => x.etat)).toEqual(['ok', 'ok']);
    expect(r.every((x) => x.motif === undefined)).toBe(true);
  });

  it("conserve l'ordre des liens même quand les réponses arrivent dans le désordre", async () => {
    const faux = (async (url: string) => {
      const rang = Number(new URL(url).pathname.slice(1));
      await attendre((5 - rang) * 8);
      return reponse(200);
    }) as unknown as typeof fetch;
    const urls = new Map<string, string[]>([0, 1, 2, 3, 4, 5].map((i) => [`https://site-${i}.fr/${i}`, [`usage-${i}`]]));
    const r = await verifierUrls(urls, { fetchImpl: faux, concurrence: 6 });
    expect(r.map((x) => x.url)).toEqual([...urls.keys()]);
  });

  it("n'attend pas le corps de la réponse : il est annulé après les en-têtes", async () => {
    let annule = false;
    const faux = (async () =>
      new Response(
        new ReadableStream({
          pull(controleur) {
            controleur.enqueue(new Uint8Array(1024));
          },
          cancel() {
            annule = true;
          },
        }),
        { status: 200 },
      )) as unknown as typeof fetch;
    const [r] = await verifierUrls(new Map([['https://gros-pdf.fr/doc.pdf', ['x']]]), { fetchImpl: faux });
    expect(r.etat).toBe('ok');
    expect(annule).toBe(true);
  });

  describe('redirections', () => {
    const redirection = (vers: string, statut = 301) => new Response(null, { status: statut, headers: { location: vers } });

    it('suit les redirections une à une, relatives comprises, et indique la page finale', async () => {
      const appels: string[] = [];
      const faux = (async (url: string) => {
        appels.push(url);
        if (url === 'http://ancien.fr/page') return redirection('https://ancien.fr/page');
        if (url === 'https://ancien.fr/page') return redirection('/nouvelle-page', 302);
        return reponse(200);
      }) as unknown as typeof fetch;
      const r = await verifierUrls(new Map([['http://ancien.fr/page', ['x']], ['https://stable.fr/p', ['y']]]), { fetchImpl: faux });
      expect(appels.filter((u) => u.includes('ancien.fr'))).toEqual(['http://ancien.fr/page', 'https://ancien.fr/page', 'https://ancien.fr/nouvelle-page']);
      expect(r[0]).toMatchObject({ etat: 'ok', statut: 200, urlFinale: 'https://ancien.fr/nouvelle-page' });
      expect(r[1].urlFinale).toBeUndefined();
    });

    it("ne suit jamais une redirection vers api.francecompetences.fr : l'adresse est ignorée sans être contactée", async () => {
      const appels: string[] = [];
      const faux = (async (url: string) => {
        appels.push(url);
        return redirection('https://api.francecompetences.fr/referentiels/x');
      }) as unknown as typeof fetch;
      const [r] = await verifierUrls(new Map([['https://relais.fr/page', ['x']]]), { fetchImpl: faux, pauseMs: 0 });
      expect(appels).toEqual(['https://relais.fr/page']);
      expect(r).toMatchObject({ etat: 'ignore', statut: null, utilisePar: ['x'] });
      expect(r.motif).toMatch(/api\.francecompetences\.fr.*R\. 6123-35/);
    });

    it.each([
      ['un point final', 'https://api.francecompetences.fr./referentiels/x'],
      ['un point final codé %2E', 'https://api.francecompetences.fr%2E/referentiels/x'],
      ['un point final, un port et des identifiants', 'https://u:p@API.francecompetences.fr.:443/x'],
      ['une adresse relative au protocole (//) et un point final', '//api.francecompetences.fr./referentiels/x'],
      ['un sous-domaine', 'https://v2.api.francecompetences.fr/x'],
    ])('ne suit jamais une redirection vers api.francecompetences.fr écrit avec %s', async (_forme, cible) => {
      const appels: string[] = [];
      const faux = (async (url: string) => {
        appels.push(url);
        return redirection(cible);
      }) as unknown as typeof fetch;
      const [r] = await verifierUrls(new Map([['https://relais.fr/page', ['x']]]), { fetchImpl: faux, pauseMs: 0 });
      expect(appels).toEqual(['https://relais.fr/page']);
      expect(r).toMatchObject({ etat: 'ignore', statut: null, utilisePar: ['x'] });
      expect(r.motif).toMatch(/api\.francecompetences\.fr.*R\. 6123-35/);
    });

    it("ne suit pas une chaîne de redirections dont le deuxième saut mène à api.francecompetences.fr (point final et port)", async () => {
      const appels: string[] = [];
      const faux = (async (url: string) => {
        appels.push(url);
        return redirection(url === 'https://a.fr/p' ? 'https://b.fr/q' : 'https://API.francecompetences.fr.:443/x');
      }) as unknown as typeof fetch;
      const [r] = await verifierUrls(new Map([['https://a.fr/p', ['x']]]), { fetchImpl: faux, pauseMs: 0 });
      expect(appels).toEqual(['https://a.fr/p', 'https://b.fr/q']);
      expect(r).toMatchObject({ etat: 'ignore', statut: null });
    });

    it('signale une boucle de redirections', async () => {
      let appels = 0;
      const faux = (async (url: string) => {
        appels += 1;
        return redirection(url);
      }) as unknown as typeof fetch;
      const [r] = await verifierUrls(new Map([['https://boucle.fr/a', ['x']]]), { fetchImpl: faux, pauseMs: 0, tentatives: 1 });
      expect(appels).toBe(11);
      expect(r).toMatchObject({ etat: 'casse', statut: null });
      expect(r.erreur).toMatch(/redirections/);
    });

    it("ne réessaie pas une boucle de redirections : elle recommencerait à l'identique (11 requêtes, pas 22)", async () => {
      let appels = 0;
      const faux = (async (url: string) => {
        appels += 1;
        return redirection(url);
      }) as unknown as typeof fetch;
      const [r] = await verifierUrls(new Map([['https://boucle.fr/a', ['x']]]), { fetchImpl: faux, pauseMs: 0, tentatives: 3 });
      expect(appels).toBe(11);
      expect(r).toMatchObject({ etat: 'casse', statut: null });
      expect(r.erreur).toMatch(/redirections/);
    });

    it('accepte tel quel un 3xx sans en-tête Location', async () => {
      const faux = (async () => reponse(304)) as unknown as typeof fetch;
      const [r] = await verifierUrls(new Map([['https://cache.fr/a', ['x']]]), { fetchImpl: faux });
      expect(r).toMatchObject({ etat: 'ok', statut: 304 });
      expect(r.urlFinale).toBeUndefined();
    });
  });

  describe('erreurs réseau et nouvelles tentatives', () => {
    it('réessaie après une erreur réseau puis accepte la réponse', async () => {
      let appels = 0;
      const faux = (async () => {
        appels += 1;
        if (appels === 1) throw new TypeError('fetch failed');
        return reponse(200);
      }) as unknown as typeof fetch;
      const [r] = await verifierUrls(new Map([['https://capricieux.fr', ['x']]]), { fetchImpl: faux, pauseMs: 0 });
      expect(appels).toBe(2);
      expect(r.etat).toBe('ok');
      expect(r.erreur).toBeUndefined();
    });

    it('réessaie un 502 une fois, jamais un 404', async () => {
      const appels: Record<string, number> = {};
      const faux = (async (url: string) => {
        appels[url] = (appels[url] ?? 0) + 1;
        return reponse(url.includes('absent') ? 404 : 502);
      }) as unknown as typeof fetch;
      const r = await verifierUrls(new Map([['https://passerelle.fr', ['a']], ['https://absent.fr', ['b']]]), { fetchImpl: faux, pauseMs: 0 });
      expect(appels).toEqual({ 'https://passerelle.fr': 2, 'https://absent.fr': 1 });
      expect(r.map((x) => [x.statut, x.etat])).toEqual([[502, 'casse'], [404, 'casse']]);
    });

    it("signale une erreur réseau persistante avec sa cause (nom d'hôte inconnu, certificat…)", async () => {
      let appels = 0;
      const faux = (async () => {
        appels += 1;
        throw Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('getaddrinfo ENOTFOUND mort.fr'), { code: 'ENOTFOUND' }) });
      }) as unknown as typeof fetch;
      const [r] = await verifierUrls(new Map([['https://mort.fr', ['x']]]), { fetchImpl: faux, pauseMs: 0, tentatives: 3 });
      expect(appels).toBe(3);
      expect(r).toMatchObject({ statut: null, etat: 'casse' });
      expect(r.erreur).toContain('fetch failed');
      expect(r.erreur).toContain('ENOTFOUND');
    });

    it('classe en « à vérifier » un serveur joint qui coupe la connexion ou répond hors protocole, sans réessayer', async () => {
      const coupure = () => Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }) });
      const horsProtocole = () =>
        Object.assign(new TypeError('fetch failed'), {
          cause: Object.assign(new Error('Response does not match the HTTP/1.1 protocol (Invalid header value char)'), { name: 'HTTPParserError' }),
        });
      const appels: Record<string, number> = {};
      const faux = (async (url: string) => {
        appels[url] = (appels[url] ?? 0) + 1;
        throw url.includes('urssaf') ? coupure() : horsProtocole();
      }) as unknown as typeof fetch;
      const r = await verifierUrls(new Map([['https://urssaf.test/page', ['a']], ['https://ladom.test/page', ['b']]]), { fetchImpl: faux, pauseMs: 0, tentatives: 3 });
      expect(appels).toEqual({ 'https://urssaf.test/page': 1, 'https://ladom.test/page': 1 });
      expect(r.map((x) => [x.etat, x.statut])).toEqual([['a_verifier', null], ['a_verifier', null]]);
      expect(r[0].erreur).toContain('ECONNRESET');
      expect(r[1].erreur).toContain('HTTP/1.1');
    });

    it('classe en « à vérifier » un serveur qui ferme la connexion sans répondre (UND_ERR_SOCKET), sans réessayer', async () => {
      let appels = 0;
      const faux = (async () => {
        appels += 1;
        throw Object.assign(new TypeError('fetch failed'), {
          cause: Object.assign(new Error('other side closed'), { name: 'SocketError', code: 'UND_ERR_SOCKET' }),
        });
      }) as unknown as typeof fetch;
      const [r] = await verifierUrls(new Map([['https://ferme.test/page', ['a']]]), { fetchImpl: faux, pauseMs: 0, tentatives: 3 });
      expect(appels).toBe(1);
      expect(r).toMatchObject({ etat: 'a_verifier', statut: null });
      expect(r.erreur).toContain('UND_ERR_SOCKET');
    });

    it.each(['CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID'])(
      'ne réessaie pas un certificat refusé (%s) : il sera le même au prochain essai',
      async (code) => {
        let appels = 0;
        const faux = (async () => {
          appels += 1;
          throw Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('certificat'), { code }) });
        }) as unknown as typeof fetch;
        const [r] = await verifierUrls(new Map([['https://certificat.test', ['a']]]), { fetchImpl: faux, pauseMs: 0, tentatives: 3 });
        expect(appels).toBe(1);
        expect(r).toMatchObject({ etat: 'casse', statut: null });
        expect(r.erreur).toContain(code);
      },
    );

    it.each(['UND_ERR_CONNECT_TIMEOUT', 'ECONNREFUSED'])('réessaie encore une erreur réseau passagère (%s)', async (code) => {
      let appels = 0;
      const faux = (async () => {
        appels += 1;
        throw Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('x'), { code }) });
      }) as unknown as typeof fetch;
      const [r] = await verifierUrls(new Map([['https://passager.test', ['a']]]), { fetchImpl: faux, pauseMs: 0, tentatives: 3 });
      expect(appels).toBe(3);
      expect(r).toMatchObject({ etat: 'casse', statut: null });
    });

    it('garde « cassé » un délai de connexion dépassé et un certificat refusé', async () => {
      const faux = (async (url: string) => {
        throw Object.assign(new TypeError('fetch failed'), {
          cause: Object.assign(new Error('x'), { code: url.includes('lent') ? 'UND_ERR_CONNECT_TIMEOUT' : 'CERT_HAS_EXPIRED' }),
        });
      }) as unknown as typeof fetch;
      const r = await verifierUrls(new Map([['https://lent.test', ['a']], ['https://perime.test', ['b']]]), { fetchImpl: faux, pauseMs: 0, tentatives: 1 });
      expect(r.map((x) => x.etat)).toEqual(['casse', 'casse']);
      expect(r[1].erreur).toContain('CERT_HAS_EXPIRED');
    });

    it('abandonne après le délai imparti et le dit', async () => {
      const faux = ((_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, rejeter) => {
          init?.signal?.addEventListener('abort', () => rejeter(new DOMException('This operation was aborted', 'AbortError')));
        })) as unknown as typeof fetch;
      const [r] = await verifierUrls(new Map([['https://lent.fr', ['x']]]), { fetchImpl: faux, timeoutMs: 20, tentatives: 1, pauseMs: 0 });
      expect(r.etat).toBe('casse');
      expect(r.statut).toBeNull();
      expect(r.erreur).toMatch(/délai/);
    });
  });

  it('limite les requêtes simultanées vers un même site sans bloquer les autres', async () => {
    const enCours: Record<string, number> = {};
    const maxParHote: Record<string, number> = {};
    const faux = (async (url: string) => {
      const hote = new URL(url).host;
      enCours[hote] = (enCours[hote] ?? 0) + 1;
      maxParHote[hote] = Math.max(maxParHote[hote] ?? 0, enCours[hote]);
      await attendre(10);
      enCours[hote] -= 1;
      return reponse(200);
    }) as unknown as typeof fetch;
    const urls = new Map<string, string[]>();
    for (let i = 0; i < 8; i++) urls.set(`https://legifrance.test/page-${i}`, [`u${i}`]);
    urls.set('https://autre.test/a', ['a']);
    urls.set('https://troisieme.test/b', ['b']);
    const r = await verifierUrls(urls, { fetchImpl: faux, concurrence: 6, parHote: 2 });
    expect(r).toHaveLength(10);
    expect(r.every((x) => x.etat === 'ok')).toBe(true);
    expect(maxParHote['legifrance.test']).toBe(2);
    expect(maxParHote['autre.test']).toBe(1);
  });

  it('compte pour un seul site les écritures avec et sans point final, pour la limite de requêtes simultanées', async () => {
    let enCours = 0;
    let maxEnCours = 0;
    const faux = (async () => {
      enCours += 1;
      maxEnCours = Math.max(maxEnCours, enCours);
      await attendre(10);
      enCours -= 1;
      return reponse(200);
    }) as unknown as typeof fetch;
    const urls = new Map<string, string[]>();
    for (let i = 0; i < 6; i++) urls.set(`https://legifrance.test${i % 2 === 0 ? '' : '.'}/page-${i}`, [`u${i}`]);
    const r = await verifierUrls(urls, { fetchImpl: faux, concurrence: 6, parHote: 2 });
    expect(r.every((x) => x.etat === 'ok')).toBe(true);
    expect(maxEnCours).toBe(2);
  });
});

describe('rapportMarkdown', () => {
  const resultats: ResultatLien[] = [
    { url: 'https://ok.fr/a', statut: 200, etat: 'ok', utilisePar: ['opco:akto.url_finance_page'] },
    { url: 'https://mort.fr/b', statut: 404, etat: 'casse', utilisePar: ['aide:nat-x.sources[0].url'] },
    { url: 'https://hors-ligne.fr/c', statut: null, etat: 'casse', erreur: 'fetch failed (ENOTFOUND)', utilisePar: ['portail:11.liens[0].url', 'idcc:0001.source', 'idcc:0002.source', 'idcc:0003.source', 'idcc:0004.source'] },
    { url: 'https://protege.fr/d', statut: 403, etat: 'a_verifier', utilisePar: ['idcc:0016.source'] },
    { url: 'https://inconnu.fr/e', statut: null, etat: 'a_verifier', utilisePar: ['naf:47.source'] },
    { url: 'https://api.francecompetences.fr/f', statut: null, etat: 'ignore', motif: 'licence France compétences (art. R. 6123-35 du code du travail)', utilisePar: ['idcc:0005.source'] },
  ];
  const rapport = rapportMarkdown(resultats, '07/10/2026');

  it('résume les chiffres et liste chaque catégorie', () => {
    expect(rapport).toContain('# Contrôle des liens sources du 07/10/2026');
    expect(rapport).toContain('6 liens : 1 OK, 2 à vérifier, 2 cassés, 1 ignoré.');
    expect(rapport).toContain('## Liens cassés');
    expect(rapport).toContain('| https://mort.fr/b | 404 | aide:nat-x.sources[0].url |');
    expect(rapport).toContain('| https://hors-ligne.fr/c | fetch failed (ENOTFOUND) | portail:11.liens[0].url, idcc:0001.source, idcc:0002.source (+2) |');
    expect(rapport).toContain('## À vérifier à la main');
    expect(rapport).toContain('| https://protege.fr/d | 403 | idcc:0016.source |');
    expect(rapport).toContain('## Liens ignorés (licence France compétences)');
    expect(rapport).toContain('| https://api.francecompetences.fr/f | licence France compétences (art. R. 6123-35 du code du travail) | idcc:0005.source |');
    expect(rapport).not.toContain('https://ok.fr/a');
  });

  it('remplace une valeur absente par n/a', () => {
    expect(rapport).toContain('| https://inconnu.fr/e | n/a | naf:47.source |');
  });

  it("n'utilise ni tiret cadratin ni emoji (charte SFG)", () => {
    expect(rapport).not.toContain(TIRET_CADRATIN);
    expect(rapport).not.toMatch(EMOJI);
  });

  it("écrit « Aucun. » à la place d'un tableau vide", () => {
    const propre = rapportMarkdown([{ url: 'https://ok.fr', statut: 200, etat: 'ok', utilisePar: ['x'] }], '07/10/2026');
    expect(propre).toContain('1 lien : 1 OK, 0 à vérifier, 0 cassé, 0 ignoré.');
    expect(propre.match(/^Aucun\.$/gm)).toHaveLength(3);
    expect(propre).not.toContain('| URL |');
  });
});
