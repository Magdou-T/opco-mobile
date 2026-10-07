import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EMBEDDED_OPCOS, getEmbeddedOpcoBySlug } from '@opco/core';
import { Bareme, BaremeDegressif, LegendeBareme } from '@/components/opco/Bareme';
import { CarteBranche } from '@/components/opco/Branche';
import { CarteDispositif, LegendeCumul } from '@/components/opco/Dispositif';
import { OuvertureDesDetails } from '@/components/opco/OuvertureDesDetails';
import { ListeTailles } from '@/components/opco/Tailles';
import { TexteDonnees } from '@/components/opco/TexteDonnees';
import { Sommaire } from '@/components/site/Sommaire';
import { TitreDeSection } from '@/components/site/TitreDeSection';
import { AlertesOpco } from '@/components/ui/AlertesOpco';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { Etiquette } from '@/components/ui/Etiquette';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { SourceBadge } from '@/components/ui/SourceBadge';
import {
  ABREVIATIONS_PAR_OPCO,
  cartesAlternance,
  elementsDeTexte,
  lignesDuBareme,
  resumeDesAlertes,
  sectionsDeLaFiche,
} from '@/lib/fiche';
import type { CarteTexteLibre, IdSection } from '@/lib/fiche';
import { CUMUL_ORDRE, dateFr, de, typo } from '@/lib/format';

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
    description: `Barèmes de prise en charge 2026 ${de(opco.name)}${verification} : plafonds horaires, budgets annuels, frais annexes, barèmes par branche, dispositifs complémentaires et alertes, avec sources officielles.`,
  };
}

/** Pastille d'icône des cartes « Alternance, CPF et VAE ». */
const ICONES_ALTERNANCE: Record<CarteTexteLibre['cle'], IconName> = {
  apprentissage: 'diplome',
  professionnalisation: 'mallette',
  cpf: 'euro',
  vae: 'document',
};

/** Classes d'une section de la fiche : filet de section ponctué d'orange, au-dessus du titre. */
const SECTION = 'rule-double pt-6';

export default async function OpcoFichePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const opco = getEmbeddedOpcoBySlug(slug);
  if (!opco) notFound();

  const sections = sectionsDeLaFiche(opco);
  const presente = (id: IdSection) => sections.some((s) => s.id === id);
  const sigles = ABREVIATIONS_PAR_OPCO[opco.slug];
  const alertes = opco.alertes ?? [];
  const variantes = opco.variantes_branche ?? [];
  const dispositifs = CUMUL_ORDRE.flatMap((cumul) =>
    (opco.dispositifs_complementaires ?? []).filter((d) => d.cumul === cumul),
  );
  const cumuls = CUMUL_ORDRE.filter((cumul) => dispositifs.some((d) => d.cumul === cumul));
  const lignes = lignesDuBareme(opco, opco.prise_en_charge_salaires_mode, opco.frais_restauration_unite);
  // La légende explique les libellés du barème général et de ceux des branches, dépliés plus bas.
  const lignesDesBranches = variantes.flatMap((v) =>
    lignesDuBareme(
      v,
      v.prise_en_charge_salaires_mode ?? opco.prise_en_charge_salaires_mode,
      v.frais_restauration_unite ?? opco.frais_restauration_unite,
    ),
  );
  const seuils = opco.cout_horaire_seuils ?? [];
  const pratique = [
    { titre: 'Demande', elements: elementsDeTexte(opco.processus_approbation) },
    { titre: 'Délai de validation', elements: elementsDeTexte(opco.delai_validation) },
    { titre: 'Mode de paiement', elements: elementsDeTexte(opco.mode_paiement) },
  ].filter((p) => p.elements.length > 0);
  const email = opco.email_contact.trim();
  const specificites = elementsDeTexte(opco.specificites);
  const pointsCles = elementsDeTexte(opco.points_cles_maximisation);

  return (
    <main>
      <OuvertureDesDetails />

      {/* ================= EN-TÊTE ================= */}
      <header className="border-b border-filet/70">
        <div className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6 md:pt-8 md:pb-14">
          <nav aria-label="Fil d'Ariane" className="text-sm print:hidden">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-texte-doux">
              <li>
                <Link href="/opco/" className="lien">
                  Les 11 OPCO
                </Link>
              </li>
              <li aria-hidden="true">
                <Icon name="chevron" className="size-3.5 text-texte-discret" strokeWidth={2} />
              </li>
              <li aria-current="page" className="font-medium text-texte">
                {opco.name}
              </li>
            </ol>
          </nav>

          <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-end lg:gap-14">
            <div>
              <p className="surtitre">Fiche OPCO · critères 2026</p>
              <h1 className="mt-4 text-affiche font-bold text-texte">{opco.name}</h1>
              {opco.nom_complet && <p className="mt-3 max-w-2xl text-chapeau text-texte-doux">{typo(opco.nom_complet)}</p>}
              {opco.derniere_verification && (
                <p className="mt-5">
                  <Etiquette tone="turquoise">Barèmes vérifiés le {dateFr(opco.derniere_verification)}</Etiquette>
                </p>
              )}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap print:hidden">
                <Button href="/simulateur/" size="lg" fleche pleineLargeur="mobile">
                  Estimer pour cet OPCO
                </Button>
                <Button href={opco.url_finance_page} variant="secondary" size="lg" icone="lien-externe" pleineLargeur="mobile">
                  Site {de(opco.name)}
                </Button>
              </div>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-texte-discret print:hidden">
                Dans le simulateur, retrouvez votre entreprise par son nom ou son SIREN, ou choisissez {opco.name}{' '}
                dans la liste des OPCO.
              </p>
            </div>

            <Card as="aside" tone="teintee" aria-labelledby="titre-secteurs">
              <h2 id="titre-secteurs" className="surtitre">
                Secteurs couverts
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-texte-doux">{typo(opco.secteurs)}</p>
            </Card>
          </div>
        </div>
      </header>

      {/* À l'impression, le sommaire est masqué : une seule colonne, sinon le contenu se range dans celle du sommaire
          (216 px) dès que la page imprimée atteint 1 024 px (A4 paysage). */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-12 lg:py-14 print:grid-cols-1">
        <Sommaire entrees={sections} etiquette={`Sommaire de la fiche ${opco.name}`} />

        <div className="min-w-0 space-y-16">
          {/* Alertes publiées par l'OPCO : signalées d'emblée, détaillées plus bas */}
          {alertes.length > 0 && (
            <Callout
              tone="alerte"
              titre={
                alertes.length > 1
                  ? `${alertes.length} alertes publiées par ${opco.name}`
                  : `Une alerte publiée par ${opco.name}`
              }
            >
              <ul className="mt-2 flex flex-wrap gap-2">
                {resumeDesAlertes(alertes).map((t) => (
                  <li
                    key={t.type}
                    className="rounded-full border border-rouge/25 bg-white px-2.5 text-xs leading-6 font-semibold text-rouge"
                  >
                    {t.libelle}
                    {t.nombre > 1 && <> ({t.nombre})</>}
                  </li>
                ))}
              </ul>
              <p className="mt-3">
                <a href="#alertes" className="lien">
                  Lire les alertes et leurs sources
                </a>
              </p>
            </Callout>
          )}

          {/* ================= BARÈME GÉNÉRAL ================= */}
          <section id="bareme" aria-labelledby="titre-bareme" className={SECTION}>
            <TitreDeSection
              id="titre-bareme"
              titre="Barème général du plan de développement des compétences (PDC)"
              chapeau={`Montants publiés par ${opco.name} pour 2026, poste par poste.`}
            />
            <div className="mt-6 space-y-4">
              <LegendeBareme lignes={[...lignes, ...lignesDesBranches]} />
              <Bareme lignes={lignes} legende={`Barème général ${de(opco.name)}, poste par poste`} sigles={sigles} />
              {seuils.length > 0 && (
                <BaremeDegressif
                  seuils={seuils}
                  mode={opco.cout_horaire_seuils_mode}
                  certifiant={opco.cout_horaire_seuils_certifiant}
                />
              )}
              {opco.budget_annuel_description && (
                <p className="text-sm leading-relaxed text-texte-doux [overflow-wrap:anywhere]">
                  <span className="font-semibold text-texte">Budget annuel&nbsp;:</span>{' '}
                  <TexteDonnees texte={opco.budget_annuel_description} sigles={sigles} />
                </p>
              )}
            </div>
          </section>

          {/* ================= SELON LA TAILLE ================= */}
          {presente('tailles') && (
            <section id="tailles" aria-labelledby="titre-tailles" className={SECTION}>
              <TitreDeSection id="titre-tailles" titre="Selon la taille de l'entreprise" />
              <div className="mt-6">
                <ListeTailles plafonds={opco.plafonds_par_taille ?? []} sigles={sigles} />
              </div>
            </section>
          )}

          {/* ================= BRANCHES ================= */}
          {presente('branches') && (
            <section id="branches" aria-labelledby="titre-branches" className={SECTION}>
              <TitreDeSection
                id="titre-branches"
                titre="Barèmes par branche professionnelle"
                chapeau={
                  variantes.length > 0
                    ? `Chez ${opco.name}, chaque branche peut fixer ses propres montants. Le simulateur applique la branche de la convention collective (IDCC) de votre entreprise, ou celle que vous choisissez.`
                    : undefined
                }
              />
              <div className="mt-6 space-y-4">
                {opco.note_variantes && (
                  <Callout tone="info" titre="À savoir">
                    <TexteDonnees texte={opco.note_variantes} sigles={sigles} />
                  </Callout>
                )}
                {variantes.length > 0 && (
                  <div className="space-y-3">
                    {variantes.map((v) => (
                      <CarteBranche key={v.id} opco={opco} variante={v} sigles={sigles} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ================= ALERTES ================= */}
          {presente('alertes') && <AlertesOpco alertes={alertes} opcoName={opco.name} headingLevel={2} id="alertes" />}

          {/* ================= DISPOSITIFS ================= */}
          {presente('dispositifs') && (
            <section id="dispositifs" aria-labelledby="titre-dispositifs" className={SECTION}>
              <TitreDeSection
                id="titre-dispositifs"
                titre="Financements complémentaires"
                chapeau={
                  <>
                    Dispositifs {de(opco.name)}{' '}au-delà du plan de développement des compétences. L&apos;étiquette de
                    chacun indique sa règle de cumul avec l&apos;enveloppe annuelle de votre entreprise.{' '}
                    <Link href="/former-sans-budget/" className="lien">
                      Comprendre comment ça marche
                    </Link>
                  </>
                }
              />
              <div className="mt-6 space-y-4">
                <LegendeCumul cumuls={cumuls} />
                {dispositifs.map((d) => (
                  <CarteDispositif key={d.id} d={d} sigles={sigles} />
                ))}
              </div>
            </section>
          )}

          {/* ================= ALTERNANCE, CPF, VAE ================= */}
          {presente('alternance') && (
            <section id="alternance" aria-labelledby="titre-alternance" className={SECTION}>
              <TitreDeSection id="titre-alternance" titre="Alternance, CPF et VAE" />
              <ul className="mt-6 grid gap-3 md:grid-cols-2">
                {cartesAlternance(opco).map((c) => (
                  <Card as="li" key={c.cle} padding="md" className="min-w-0 break-inside-avoid [overflow-wrap:anywhere]">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="grid size-10 shrink-0 place-items-center rounded-2xl bg-turquoise-soft text-turquoise-deep"
                      >
                        <Icon name={ICONES_ALTERNANCE[c.cle]} className="size-5" />
                      </span>
                      <h3 className="text-lg leading-snug font-bold text-texte">{c.titre}</h3>
                    </div>
                    <div className="mt-3 space-y-2 text-sm leading-relaxed text-texte-doux">
                      {c.elements.map((e, i) => (
                        <p key={i}>
                          <TexteDonnees texte={e} sigles={sigles} />
                        </p>
                      ))}
                    </div>
                    {c.source && (
                      <div className="mt-4">
                        <SourceBadge url={c.source} />
                      </div>
                    )}
                  </Card>
                ))}
              </ul>
            </section>
          )}

          {/* ================= EN PRATIQUE ================= */}
          <section id="pratique" aria-labelledby="titre-pratique" className={SECTION}>
            <TitreDeSection id="titre-pratique" titre="En pratique" />
            <div className="mt-6 space-y-4">
              <Card padding="none" className="overflow-clip">
                <dl className="divide-y divide-filet">
                  {pratique.map((p) => (
                    <div key={p.titre} className="grid gap-1 px-5 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6 sm:px-6">
                      <dt className="text-sm font-semibold text-texte">{p.titre}</dt>
                      <dd className="space-y-1.5 text-sm leading-relaxed text-texte-doux [overflow-wrap:anywhere]">
                        {p.elements.map((e, i) => (
                          <p key={i}>
                            <TexteDonnees texte={e} sigles={sigles} />
                          </p>
                        ))}
                      </dd>
                    </div>
                  ))}
                  <div className="grid gap-2 px-5 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6 sm:px-6">
                    <dt className="text-sm font-semibold text-texte">Contact</dt>
                    <dd className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-texte-doux">
                      {email !== '' && (
                        <Button href={`mailto:${email}`} variant="secondary" icone="courriel">
                          Écrire à {opco.name}
                        </Button>
                      )}
                      <Button href={opco.url_finance_page} variant="ghost" icone="lien-externe">
                        Site {de(opco.name)}
                      </Button>
                      {email !== '' && <span className="w-full break-words">{email}</span>}
                    </dd>
                  </div>
                </dl>
              </Card>

              {specificites.length > 0 && (
                <Callout tone="info" titre="À savoir">
                  <ul className="mt-1 space-y-1.5">
                    {specificites.map((e, i) => (
                      <li key={i} className="flex gap-2.5 [overflow-wrap:anywhere]">
                        <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-turquoise-deep" />
                        <span className="min-w-0">
                          <TexteDonnees texte={e} sigles={sigles} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </Callout>
              )}

              {pointsCles.length > 0 && (
                <Callout tone="confirmation" titre="Maximiser la prise en charge">
                  <ul className="mt-1 space-y-1.5">
                    {pointsCles.map((e, i) => (
                      <li key={i} className="flex gap-2.5 [overflow-wrap:anywhere]">
                        <Icon name="coche" className="mt-0.5 size-4 shrink-0 text-turquoise-deep" strokeWidth={2} />
                        <span className="min-w-0">
                          <TexteDonnees texte={e} sigles={sigles} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </Callout>
              )}

              <p className="flex items-start gap-2.5 pt-2 text-sm leading-relaxed text-texte-discret">
                <Icon name="info" className="mt-0.5 size-4 shrink-0 text-turquoise-deep" />
                <span>
                  Les barèmes {de(opco.name)}{' '}varient selon les branches professionnelles et peuvent être révisés en
                  cours d&apos;année, dans la limite des fonds disponibles. Seul {opco.name}{' '}confirme une prise en
                  charge après étude du dossier.
                </span>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
