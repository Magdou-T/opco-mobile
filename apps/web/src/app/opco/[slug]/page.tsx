import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { COMPANY_SIZE_LABELS, EMBEDDED_OPCOS, getEmbeddedOpcoBySlug } from '@opco/core';
import type {
  CoutHoraireSeuil,
  DispositifComplementaire,
  ModeSeuils,
  OpcoData,
  PlafondTaille,
  SourcedValue,
  VarianteBranche,
} from '@opco/core';
import { AlertesOpco } from '@/components/ui/AlertesOpco';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { CumulBadge } from '@/components/ui/CumulBadge';
import { SourceBadge } from '@/components/ui/SourceBadge';
import { CUMUL_EXPLICATIONS, CUMUL_ORDRE, UNITE_DISPOSITIF_LABELS, dateFr } from '@/lib/format';

export function generateStaticParams() {
  return EMBEDDED_OPCOS.map((o) => ({ slug: o.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const opco = getEmbeddedOpcoBySlug(slug);
  if (!opco) return {};
  const verification = opco.derniere_verification
    ? ` vérifiés le ${dateFr(opco.derniere_verification)}`
    : '';
  return {
    title: `${opco.name} : barèmes de financement 2026, conditions, dispositifs`,
    description: `Barèmes de prise en charge 2026 de ${opco.name}${verification} : plafonds horaires, budgets annuels, frais annexes, barèmes par branche, dispositifs complémentaires et alertes, avec sources officielles.`,
  };
}

const nombre = (n: number): string => n.toLocaleString('fr-FR');

const LIBELLES_VAE: Record<string, string> = {
  vae_simple: 'VAE sans action de formation',
  vae_mixte: 'VAE avec action de formation',
};

/**
 * Plusieurs champs textuels des données (alternance, CPF, VAE) ne sont pas des chaînes alors que les types du moteur
 * les déclarent comme telles : { description, note, ... } (OPCO EP, OPCO Santé) ou { vae_simple: { value, note },
 * vae_mixte: { value, note } } (VAE d'Uniformation). On les lit donc comme des valeurs inconnues, un paragraphe par
 * texte ; une valeur sans texte exploitable donne une liste vide.
 */
function paragraphes(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value] : [];
  if (value == null || typeof value !== 'object') return [];
  const champs = value as Record<string, unknown>;
  const textes: string[] = [];
  if (typeof champs.description === 'string') textes.push(champs.description);
  if (typeof champs.note === 'string') textes.push(champs.note);
  for (const [cle, libelle] of Object.entries(LIBELLES_VAE)) {
    const poste = champs[cle];
    if (poste == null || typeof poste !== 'object') continue;
    const { value: montant, note } = poste as { value?: unknown; note?: unknown };
    const intitule = typeof montant === 'number' ? `${libelle} : jusqu'à ${nombre(montant)} €.` : `${libelle}.`;
    textes.push(typeof note === 'string' ? `${intitule} ${note}` : intitule);
  }
  return textes;
}

function CarteTexte({ titre, valeur }: { titre: string; valeur: unknown }) {
  const textes = paragraphes(valeur);
  if (textes.length === 0) return null;
  return (
    <div className="rounded border border-rule bg-white p-4">
      <div className="marginalia">{titre}</div>
      {textes.map((t, i) => (
        <p key={i} className="mt-2 text-sm leading-relaxed text-ink-soft">
          {t}
        </p>
      ))}
    </div>
  );
}

/** Postes du barème communs à l'OPCO et à ses variantes de branche (une variante n'en renseigne que certains). */
type PostesBareme = Partial<
  Pick<
    OpcoData,
    | 'cout_horaire_inter'
    | 'cout_horaire_intra'
    | 'cout_horaire_metier'
    | 'prise_en_charge_salaires'
    | 'frais_transport'
    | 'frais_hebergement'
    | 'frais_restauration'
    | 'frais_annexes_pourcentage'
    | 'budget_annuel_max'
  >
>;

function BaremeRow({
  label,
  sourced,
  unit,
  valeurNulle,
}: {
  label: string;
  sourced: SourcedValue<number | null> | undefined;
  unit: string;
  /** Libellé d'une valeur absente ; par défaut selon la fiabilité (voir ci-dessous). */
  valeurNulle?: string;
}) {
  if (!sourced) return null;
  // Valeur absente et « exact » : l'OPCO publie qu'il n'y a pas de forfait ni de plafond chiffré (frais réels, pas de
  // prise en charge...), la précision donne la règle. Sinon l'OPCO ne publie pas de barème pour ce poste.
  const libelleNul = valeurNulle ?? (sourced.confidence === 'exact' ? 'sans montant fixe' : 'non publié');
  return (
    <tr>
      <td className="px-4 py-3 align-top font-medium text-ink">{label}</td>
      <td className="amount px-4 py-3 text-right align-top">
        {sourced.value != null ? (
          <span className="font-semibold">
            {nombre(sourced.value)} {unit}
          </span>
        ) : (
          <span className="text-ink-faint">{libelleNul}</span>
        )}
      </td>
      <td className="px-4 py-3 text-center align-top">
        <ConfidenceBadge confidence={sourced.confidence} />
      </td>
      <td className="hidden px-4 py-3 align-top text-xs leading-relaxed text-ink-faint md:table-cell">
        {sourced.note}
      </td>
      <td className="px-4 py-3 text-center align-top">
        {sourced.source_url && <SourceBadge url={sourced.source_url} />}
      </td>
    </tr>
  );
}

/** Lignes d'un barème (général ou de branche) : seuls les postes renseignés s'affichent. */
function LignesBareme({
  bareme,
  modeSalaires,
  uniteRestauration,
}: {
  bareme: PostesBareme;
  modeSalaires: OpcoData['prise_en_charge_salaires_mode'];
  uniteRestauration: OpcoData['frais_restauration_unite'];
}) {
  const forfaitAnnexes = bareme.frais_annexes_pourcentage;
  const salairesEnPourcentage = modeSalaires === 'pourcentage_pedagogique';
  return (
    <>
      <BaremeRow label="Coût pédagogique (inter-entreprises)" sourced={bareme.cout_horaire_inter} unit="€/h" />
      <BaremeRow label="Coût pédagogique (intra-entreprise)" sourced={bareme.cout_horaire_intra} unit="€/h" />
      <BaremeRow
        label="Coût pédagogique (certifications, CQP, habilitations)"
        sourced={bareme.cout_horaire_metier}
        unit="€/h"
      />
      <BaremeRow
        label={
          salairesEnPourcentage
            ? 'Prise en charge des salaires (% des coûts pédagogiques)'
            : 'Prise en charge des salaires'
        }
        sourced={bareme.prise_en_charge_salaires}
        unit={salairesEnPourcentage ? '%' : '€/h'}
        valeurNulle={modeSalaires === 'inclus_plafond_horaire' ? 'incluse dans le plafond horaire' : undefined}
      />
      <BaremeRow label="Frais de transport" sourced={bareme.frais_transport} unit="€/jour" />
      <BaremeRow label="Frais d'hébergement" sourced={bareme.frais_hebergement} unit="€/nuit" />
      <BaremeRow
        label="Frais de restauration"
        sourced={bareme.frais_restauration}
        unit={uniteRestauration === 'repas' ? '€/repas' : '€/jour'}
      />
      {forfaitAnnexes && forfaitAnnexes.value != null && (
        <BaremeRow label="Frais annexes (forfait en % des coûts pédagogiques)" sourced={forfaitAnnexes} unit="%" />
      )}
      <BaremeRow label="Budget annuel maximum" sourced={bareme.budget_annuel_max} unit="€/an" />
    </>
  );
}

function TableauBareme({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded border border-rule bg-white">
      <table className="w-full text-sm">
        <thead className="bg-paper-deep">
          <tr>
            <th className="marginalia px-4 py-3 text-left">Poste</th>
            <th className="marginalia px-4 py-3 text-right">Montant</th>
            <th className="marginalia px-4 py-3 text-center">Fiabilité</th>
            <th className="marginalia hidden px-4 py-3 text-left md:table-cell">Précision</th>
            <th className="marginalia px-4 py-3 text-center">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">{children}</tbody>
      </table>
    </div>
  );
}

/** Barème dégressif selon la durée de la formation (Uniformation, par exemple). */
function BaremeDegressif({
  seuils,
  mode,
  certifiant,
}: {
  seuils: CoutHoraireSeuil[];
  mode: ModeSeuils | undefined;
  certifiant: boolean | undefined;
}) {
  const tranches = [...seuils].sort((a, b) => (a.max_heures ?? Infinity) - (b.max_heures ?? Infinity));
  const selonDureeTotale = mode === 'selon_duree_totale';
  const libelleTranche = (t: CoutHoraireSeuil, i: number): string => {
    const borneBasse = i > 0 ? tranches[i - 1].max_heures : 0;
    if (selonDureeTotale) {
      return t.max_heures != null
        ? `formation de ${nombre(t.max_heures)} h ou moins`
        : `formation de plus de ${nombre(borneBasse ?? 0)} h`;
    }
    return t.max_heures != null
      ? `de ${nombre(borneBasse ?? 0)} à ${nombre(t.max_heures)} h`
      : `au-delà de ${nombre(borneBasse ?? 0)} h`;
  };

  return (
    <div className="mt-4 rounded border border-marker bg-marker-soft p-4">
      <div className="marginalia !text-ink-soft">Barème dégressif selon la durée</div>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        {selonDureeTotale
          ? "Un seul taux s'applique à toute la formation, choisi selon sa durée totale"
          : "Chaque tranche d'heures est financée à son propre taux"}
        {certifiant ? ' ; ce barème ne vaut que pour les formations certifiantes' : ''}.
      </p>
      <ul className="mt-2 space-y-0.5 text-sm">
        {tranches.map((t, i) => (
          <li key={i} className="amount">
            {libelleTranche(t, i)} : <strong>{nombre(t.valeur)} €/h</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Chiffres d'un plafond par taille d'entreprise (la description en prose reste la référence). */
function ChiffresTaille({ plafond }: { plafond: PlafondTaille }) {
  const chiffres: [string, string][] = [];
  if (plafond.budget_annuel_max != null) chiffres.push(['Budget annuel', `${nombre(plafond.budget_annuel_max)} €`]);
  if (plafond.cout_horaire_max != null) chiffres.push(['Plafond horaire', `${nombre(plafond.cout_horaire_max)} €/h`]);
  if (plafond.prise_en_charge_salaires_horaire != null) {
    chiffres.push(['Salaires', `${nombre(plafond.prise_en_charge_salaires_horaire)} €/h`]);
  }
  if (plafond.quota_horaire_max != null) chiffres.push(["Plafond d'heures", `${nombre(plafond.quota_horaire_max)} h`]);
  if (chiffres.length === 0) return null;
  return (
    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
      {chiffres.map(([libelle, valeur]) => (
        <div key={libelle} className="flex gap-1.5">
          <dt className="text-ink-faint">{libelle}</dt>
          <dd className="amount font-semibold text-ink">{valeur}</dd>
        </div>
      ))}
    </dl>
  );
}

function ListeTailles({ plafonds }: { plafonds: PlafondTaille[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {plafonds.map((p) => (
        <div key={p.taille} className="rounded border border-rule bg-white p-4">
          <div className="marginalia">{COMPANY_SIZE_LABELS[p.taille]}</div>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{p.description}</p>
          <ChiffresTaille plafond={p} />
        </div>
      ))}
    </div>
  );
}

function MontantDispositif({ d }: { d: DispositifComplementaire }) {
  const parties: string[] = [];
  if (d.pourcentage_couts != null) parties.push(`${nombre(d.pourcentage_couts)} % des coûts pédagogiques`);
  if (d.montant_max != null) {
    const unite = d.unite ? ` ${UNITE_DISPOSITIF_LABELS[d.unite]}` : '';
    parties.push(`${d.pourcentage_couts != null ? 'dans la limite de' : "jusqu'à"} ${nombre(d.montant_max)} €${unite}`);
  }
  if (parties.length === 0) return null;
  return <p className="mt-2 text-sm font-semibold text-ink">{parties.join(', ')}</p>;
}

function DispositifFiche({ d }: { d: DispositifComplementaire }) {
  const idccReserves = d.idcc && d.idcc.length > 0 ? d.idcc : null;
  return (
    <article className="rounded border border-rule bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-display font-bold">{d.nom}</h3>
        <CumulBadge cumul={d.cumul} />
      </div>
      <MontantDispositif d={d} />
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{d.description}</p>
      {d.conditions.length > 0 && (
        <ul className="mt-3 space-y-1">
          {d.conditions.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
              <span className="mt-0.5 text-cobalt">•</span>
              {c}
            </li>
          ))}
        </ul>
      )}
      {d.demarches && (
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          <strong className="font-semibold text-ink">Démarche :</strong> {d.demarches}
        </p>
      )}
      <dl className="mt-3 space-y-1 text-xs leading-relaxed text-ink-faint">
        {d.publics && (
          <div className="flex gap-1.5">
            <dt className="font-semibold">Public visé :</dt>
            <dd>{d.publics}</dd>
          </div>
        )}
        {d.tailles_eligibles && (
          <div className="flex gap-1.5">
            <dt className="font-semibold">Entreprises concernées :</dt>
            <dd>{d.tailles_eligibles.map((t) => COMPANY_SIZE_LABELS[t]).join(', ')}</dd>
          </div>
        )}
        {idccReserves && (
          <div className="flex gap-1.5">
            <dt className="font-semibold">Réservé aux conventions collectives :</dt>
            <dd>IDCC {idccReserves.join(', ')}</dd>
          </div>
        )}
      </dl>
      {d.note && <p className="mt-2 text-xs leading-relaxed text-ink-faint">{d.note}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ConfidenceBadge confidence={d.confidence} />
        <SourceBadge url={d.source_url} />
      </div>
    </article>
  );
}

function VarianteFiche({ opco, variante }: { opco: OpcoData; variante: VarianteBranche }) {
  return (
    <article id={variante.id} className="scroll-mt-6 rounded border border-rule bg-white">
      <header className="border-b border-rule p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="font-display text-lg font-bold">{variante.branche_nom}</h3>
          <ConfidenceBadge confidence={variante.confidence} />
        </div>
        <p className="marginalia mt-1.5">
          {variante.idcc.length > 1 ? 'Conventions collectives' : 'Convention collective'} · IDCC{' '}
          {variante.idcc.join(', ')}
        </p>
        {variante.note && (
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">{variante.note}</p>
        )}
        <div className="mt-3">
          <SourceBadge url={variante.source_url} label="Source de la branche" />
        </div>
      </header>
      <div className="p-5 pt-4">
        <p className="mb-3 text-xs text-ink-faint">
          Postes que cette branche fixe elle-même ; les autres postes suivent le barème général de {opco.name}.
        </p>
        <TableauBareme>
          <LignesBareme
            bareme={variante}
            modeSalaires={variante.prise_en_charge_salaires_mode ?? opco.prise_en_charge_salaires_mode}
            uniteRestauration={variante.frais_restauration_unite ?? opco.frais_restauration_unite}
          />
        </TableauBareme>
        {variante.cout_horaire_seuils && variante.cout_horaire_seuils.length > 0 && (
          <BaremeDegressif
            seuils={variante.cout_horaire_seuils}
            mode={variante.cout_horaire_seuils_mode ?? opco.cout_horaire_seuils_mode}
            certifiant={variante.cout_horaire_seuils_certifiant ?? opco.cout_horaire_seuils_certifiant}
          />
        )}
        {variante.budget_annuel_description && (
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            <strong>Budget annuel :</strong> {variante.budget_annuel_description}
          </p>
        )}
        {variante.plafonds_par_taille && variante.plafonds_par_taille.length > 0 && (
          <div className="mt-4">
            <div className="marginalia mb-2">Selon la taille de l&apos;entreprise</div>
            <ListeTailles plafonds={variante.plafonds_par_taille} />
          </div>
        )}
      </div>
    </article>
  );
}

export default async function OpcoFichePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const opco = getEmbeddedOpcoBySlug(slug);
  if (!opco) notFound();

  const alertes = opco.alertes ?? [];
  const dispositifs = CUMUL_ORDRE.flatMap((cumul) =>
    (opco.dispositifs_complementaires ?? []).filter((d) => d.cumul === cumul),
  );
  const variantes = opco.variantes_branche ?? [];

  return (
    <main>
      {/* En-tête fiche */}
      <header className="border-b border-ink">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-14">
          <nav className="marginalia mb-4" aria-label="Fil d'ariane">
            <Link href="/opco" className="hover:text-cobalt hover:underline">
              Les 11 OPCO
            </Link>{' '}
            / {opco.name}
          </nav>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {opco.name}
          </h1>
          {opco.nom_complet && (
            <p className="mt-1 text-lg font-medium text-ink-soft">{opco.nom_complet}</p>
          )}
          <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">{opco.secteurs}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <a
              href={opco.url_finance_page}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-cobalt px-4 py-2 font-semibold text-white hover:bg-navy"
            >
              Critères officiels {opco.name} ↗
            </a>
            <Link
              href="/simulateur"
              className="rounded border border-ink px-4 py-2 font-semibold hover:bg-paper-deep"
            >
              Simuler un financement
            </Link>
          </div>
          {opco.derniere_verification && (
            <p className="marginalia mt-4">
              Barèmes vérifiés le {dateFr(opco.derniere_verification)}
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:px-6">
        {/* Alertes publiées par l'OPCO */}
        {alertes.length > 0 && <AlertesOpco alertes={alertes} opcoName={opco.name} headingLevel={2} />}

        {/* Barèmes */}
        <section>
          <div className="rule-double pt-5">
            <h2 className="font-display text-2xl font-bold">
              Barèmes du plan de développement des compétences
            </h2>
          </div>
          <p className="mt-3 max-w-3xl text-sm text-ink-soft">
            Montants publiés par {opco.name}{' '}pour 2026. « Non publié » signifie que
            l&apos;OPCO ne communique pas de barème national : le montant dépend de votre
            branche, contactez votre conseiller. « Sans montant fixe » signifie que l&apos;OPCO
            n&apos;applique ni forfait ni plafond chiffré pour ce poste (frais réels, ou pas de prise
            en charge) : la colonne Précision donne la règle publiée.
          </p>
          <div className="mt-5">
            <TableauBareme>
              <LignesBareme
                bareme={opco}
                modeSalaires={opco.prise_en_charge_salaires_mode}
                uniteRestauration={opco.frais_restauration_unite}
              />
            </TableauBareme>
          </div>
          {opco.cout_horaire_seuils && opco.cout_horaire_seuils.length > 0 && (
            <BaremeDegressif
              seuils={opco.cout_horaire_seuils}
              mode={opco.cout_horaire_seuils_mode}
              certifiant={opco.cout_horaire_seuils_certifiant}
            />
          )}
          {opco.budget_annuel_description && (
            <p className="mt-3 text-sm text-ink-soft">
              <strong>Budget annuel :</strong> {opco.budget_annuel_description}
            </p>
          )}
        </section>

        {/* Plafonds par taille */}
        {opco.plafonds_par_taille && opco.plafonds_par_taille.length > 0 && (
          <section>
            <div className="rule-double pt-5">
              <h2 className="font-display text-2xl font-bold">Selon la taille de l&apos;entreprise</h2>
            </div>
            <div className="mt-5">
              <ListeTailles plafonds={opco.plafonds_par_taille} />
            </div>
          </section>
        )}

        {/* Dispositifs complémentaires et règle de cumul */}
        {dispositifs.length > 0 && (
          <section>
            <div className="rule-double pt-5">
              <h2 className="font-display text-2xl font-bold">Financements complémentaires</h2>
            </div>
            <p className="mt-3 max-w-3xl text-sm text-ink-soft">
              Dispositifs de {opco.name}{' '}au-delà du plan de développement des compétences. Le tampon de
              chacun indique sa règle de cumul avec l&apos;enveloppe annuelle de votre entreprise.{' '}
              <Link href="/former-sans-budget" className="text-cobalt underline">
                Comprendre comment ça marche →
              </Link>
            </p>
            <dl className="mt-4 grid gap-3 text-xs leading-relaxed text-ink-soft md:grid-cols-3">
              {CUMUL_ORDRE.map((cumul) => (
                <div key={cumul} className="rounded border border-rule bg-paper-deep p-3">
                  <dt>
                    <CumulBadge cumul={cumul} />
                  </dt>
                  <dd className="mt-2">{CUMUL_EXPLICATIONS[cumul]}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 space-y-4">
              {dispositifs.map((d) => (
                <DispositifFiche key={d.id} d={d} />
              ))}
            </div>
          </section>
        )}

        {/* Barèmes par branche professionnelle */}
        {(variantes.length > 0 || opco.note_variantes) && (
          <section>
            <div className="rule-double pt-5">
              <h2 className="font-display text-2xl font-bold">Barèmes par branche professionnelle</h2>
            </div>
            {variantes.length > 0 && (
              <p className="mt-3 max-w-3xl text-sm text-ink-soft">
                Dans {opco.name}, chaque branche peut fixer ses propres montants. Le simulateur applique
                automatiquement la branche qui correspond à la convention collective (IDCC) de votre
                entreprise, ou celle que vous choisissez.
              </p>
            )}
            {opco.note_variantes && (
              <div className="mt-4 rounded border border-cobalt/40 bg-cobalt-soft p-4">
                <div className="marginalia !text-navy">À savoir</div>
                <p className="mt-2 text-sm leading-relaxed text-navy">{opco.note_variantes}</p>
              </div>
            )}
            {variantes.length > 0 && (
              <div className="mt-5 space-y-6">
                {variantes.map((v) => (
                  <VarianteFiche key={v.id} opco={opco} variante={v} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Alternance, CPF, VAE */}
        <section>
          <div className="rule-double pt-5">
            <h2 className="font-display text-2xl font-bold">Alternance, CPF et VAE</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <CarteTexte titre="Apprentissage" valeur={opco.alternance_apprentissage} />
            <CarteTexte titre="Professionnalisation" valeur={opco.alternance_professionnalisation} />
            {opco.cpf_abondement && <CarteTexte titre="Abondement CPF" valeur={opco.cpf_details} />}
            {opco.vae_possible && <CarteTexte titre="VAE" valeur={opco.vae_details} />}
          </div>
        </section>

        {/* Conditions pratiques */}
        <section>
          <div className="rule-double pt-5">
            <h2 className="font-display text-2xl font-bold">En pratique</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded border border-rule bg-white p-4">
              <div className="marginalia">Demande</div>
              <p className="mt-2 text-sm text-ink-soft">{opco.processus_approbation}</p>
            </div>
            <CarteTexte titre="Délai de validation" valeur={opco.delai_validation} />
            {opco.mode_paiement && (
              <div className="rounded border border-rule bg-white p-4">
                <div className="marginalia">Mode de paiement</div>
                <p className="mt-2 text-sm text-ink-soft">{opco.mode_paiement}</p>
              </div>
            )}
            {opco.email_contact.trim() !== '' && (
              <div className="rounded border border-rule bg-white p-4">
                <div className="marginalia">Contact</div>
                <p className="mt-2 text-sm text-ink-soft">
                  <a href={`mailto:${opco.email_contact}`} className="font-medium text-cobalt underline hover:text-navy">
                    {opco.email_contact}
                  </a>
                </p>
              </div>
            )}
          </div>
          {opco.specificites && (
            <div className="mt-4 rounded border border-cobalt/40 bg-cobalt-soft p-4">
              <div className="marginalia !text-navy">À savoir</div>
              <p className="mt-2 text-sm leading-relaxed text-navy">{opco.specificites}</p>
            </div>
          )}
          {opco.points_cles_maximisation && (
            <div className="mt-4 rounded border border-valid/40 bg-valid-soft p-4">
              <div className="marginalia !text-valid">Maximiser la prise en charge</div>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{opco.points_cles_maximisation}</p>
            </div>
          )}
        </section>

        {/* Disclaimer */}
        <div className="rounded border border-rule bg-paper-deep p-4 text-center text-xs leading-relaxed text-ink-soft">
          Les barèmes de {opco.name}{' '}varient selon les branches professionnelles et peuvent être
          révisés en cours d&apos;année, dans la limite des fonds disponibles. Seul {opco.name}{' '}
          confirme une prise en charge après étude du dossier.
        </div>
      </div>
    </main>
  );
}
