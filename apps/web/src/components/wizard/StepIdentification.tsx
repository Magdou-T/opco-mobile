'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import {
  COMPANY_SIZE_LABELS,
  EMBEDDED_IDCC,
  EMBEDDED_NAF,
  EMBEDDED_OPCO_LIST,
  TRANCHES_EFFECTIF_INSEE,
  URL_VERIFICATION_OPCO,
  departementDuCodePostal,
  getEmbeddedOpcoBySlug,
  regionDuDepartement,
  resolveVarianteBranche,
  resoudreOpco,
  tailleDepuisTranche,
} from '@opco/core';
import type {
  CandidatOpco,
  CodeRegion,
  CompanySize,
  EntrepriseInfo,
  OpcoData,
  ResolutionOpco,
  TypeStructure,
  WizardState,
} from '@opco/core';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { CertitudeBadge } from '@/components/ui/CertitudeBadge';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { ChampRegion, ChoiceButton, ChoiceGroup, NumberField, OpcoPicker, TextField } from '@/components/ui/forms';
import { useSirenLookup } from '@/hooks/useSirenLookup';
import {
  entreeDeResolution,
  etatDepuisEffectif,
  etatDepuisEntreprise,
  etatSansEntreprise,
  opcoRequis,
  ouvreBudgetOpco,
} from '@/lib/entreprise';
import { texteFr } from '@/lib/format';
import { INSECABLE } from '@/lib/insecable';
import { idccAffichables, numeroLisible } from '@/lib/recherche';
import { EnTeteEtape } from './EnTeteEtape';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
}

/** Façon de renseigner l'entreprise : recherche dans la base publique, ou saisie de l'OPCO et de la région à la main. */
type Mode = 'recherche' | 'manuel';

/** Titre qui reçoit le focus quand le contrôle qui l'avait disparaît (résultat choisi, liste refermée). */
type CibleFocus = 'entreprise' | 'opco';

const STATUTS_STRUCTURE: Record<TypeStructure, string> = {
  ess: 'Économie sociale et solidaire (ESS)',
  siae: "Structure d'insertion par l'activité économique (SIAE)",
  association: 'Association',
};

/** Nombre maximal d'IDCC listés sous un résultat de recherche (un grand groupe peut en déclarer des dizaines). */
const IDCC_AFFICHES = 6;

const MOTIF_CANDIDAT_CHOISI = 'Vous avez choisi cet OPCO parmi les candidats.';

const nomOpco = (slug: string): string => EMBEDDED_OPCO_LIST.find((o) => o.slug === slug)?.name ?? slug;

/** Lien vers un outil officiel, ouvert dans un nouvel onglet (annoncé comme tel aux lecteurs d'écran). */
function LienOfficiel({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="lien inline-flex min-h-11 items-center gap-1.5 text-sm lg:min-h-9"
    >
      {children}
      <Icon name="lien-externe" className="size-4 shrink-0" />
      <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
    </a>
  );
}

/** Bouton d'action secondaire au dessin d'un lien (orange foncé souligné, cible de 44 px sous 1 024 px). */
function BoutonLien({
  onClick,
  icone,
  children,
  expanded,
  controls,
}: {
  onClick: () => void;
  icone?: IconName;
  children: ReactNode;
  expanded?: boolean;
  controls?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls={controls}
      className="lien inline-flex min-h-11 items-center gap-1.5 text-left text-sm lg:min-h-9"
    >
      {icone && (
        <Icon
          name={icone}
          className={`size-4 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
      )}
      {children}
    </button>
  );
}

/**
 * En-tête des cartes Entreprise et OPCO : pastille et titre côte à côte, la pastille au-dessus sous 360 px (à côté
 * d'elle, un nom comme « SFG DEVELOPPEMENT » ne tenait plus sur la ligne et se coupait au milieu du mot).
 */
const ENTETE_DE_CARTE = 'flex flex-col items-start gap-3 min-[360px]:flex-row min-[360px]:gap-4';

/** Pastille d'icône d'une carte (DESIGN.md, section 6). */
function Pastille({ icone }: { icone: IconName }) {
  return (
    <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-turquoise-soft text-turquoise-deep">
      <Icon name={icone} className="size-[22px]" />
    </span>
  );
}

/** Ce que la recherche a établi sur l'entreprise choisie. */
function CarteEntreprise({ state, titreRef }: { state: WizardState; titreRef: Ref<HTMLHeadingElement> }) {
  const effectif = state.trancheEffectifInsee ? TRANCHES_EFFECTIF_INSEE[state.trancheEffectifInsee] : null;
  const lignes: [string, string | null | undefined][] = [
    ['SIREN', state.sirenNumber && numeroLisible(state.sirenNumber)],
    ['SIRET du siège', state.siret && numeroLisible(state.siret)],
    ['Code NAF', state.codeNaf],
    ["Effectif déclaré à l'INSEE", effectif],
    ['Statut', state.structures.map((s) => STATUTS_STRUCTURE[s]).join(', ')],
  ];
  return (
    <Card padding="md">
      <div className={ENTETE_DE_CARTE}>
        <Pastille icone="batiment" />
        <div className="min-w-0 flex-1">
          <p className="marginalia">Entreprise identifiée</p>
          <h3
            ref={titreRef}
            tabIndex={-1}
            className="mt-1 rounded-md text-lg leading-snug font-bold tracking-[-0.01em] break-words text-texte"
          >
            {state.detectedCompanyName}
          </h3>
        </div>
      </div>
      <dl className="mt-4 divide-y divide-filet border-t border-filet text-sm">
        {lignes
          .filter(([, valeur]) => valeur)
          .map(([libelle, valeur]) => (
            <div key={libelle} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 py-2">
              <dt className="text-texte-doux">{libelle}</dt>
              <dd className="font-medium break-words text-texte">{valeur}</dd>
            </div>
          ))}
      </dl>
    </Card>
  );
}

/**
 * OPCO retenu pour l'entreprise, avec le niveau de certitude de l'identification, ses motifs et ses avertissements.
 * `resolution` est nulle tant qu'aucune entreprise n'est choisie (l'OPCO ne peut alors venir que d'un choix manuel).
 */
function CarteOpco({
  state,
  resolution,
  titreRef,
  listeOuverte,
  onToggleListe,
  onChoisirOpco,
  onChoisirCandidat,
  onRevenir,
}: {
  state: WizardState;
  resolution: ResolutionOpco | null;
  titreRef: Ref<HTMLHeadingElement>;
  listeOuverte: boolean;
  onToggleListe: () => void;
  onChoisirOpco: (slug: string) => void;
  onChoisirCandidat: (candidat: CandidatOpco) => void;
  onRevenir: () => void;
}) {
  const choixManuel = state.selectedOpcoSlug != null;
  const slug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = slug ? getEmbeddedOpcoBySlug(slug) : undefined;
  const candidats = resolution && !choixManuel && resolution.candidats.length > 1 ? resolution.candidats : null;
  // Un candidat autre que celui que le motif présélectionne : le motif décrirait un autre choix.
  const autreCandidat =
    candidats != null && resolution?.opcoSlug != null && state.detectedOpcoSlug !== resolution.opcoSlug;
  const idListe = 'liste-des-opco';

  return (
    <Card padding="md" className="space-y-4">
      <div className={ENTETE_DE_CARTE}>
        <Pastille icone="bouclier" />
        <div className="min-w-0 flex-1">
          <p className="marginalia">Votre OPCO</p>
          <h3
            ref={titreRef}
            tabIndex={-1}
            className="mt-1 rounded-md text-lg leading-snug font-bold tracking-[-0.01em] text-texte"
          >
            {opco?.name ?? 'OPCO non identifié'}
          </h3>
          {opco?.nom_complet && <p className="mt-0.5 text-sm leading-snug text-texte-doux">{opco.nom_complet}</p>}
        </div>
      </div>

      {/* Sur sa propre ligne : l'étiquette ne se coupe pas et tient dans la carte dès 320 px. */}
      {resolution && !choixManuel && (
        <div>
          <CertitudeBadge certitude={resolution.certitude} />
        </div>
      )}

      {choixManuel ? (
        <p className="text-sm leading-relaxed text-texte-doux">OPCO choisi manuellement.</p>
      ) : (
        resolution && (
          <>
            <p className="text-sm leading-relaxed text-texte-doux">
              {autreCandidat ? MOTIF_CANDIDAT_CHOISI : texteFr(resolution.motif)}
            </p>
            {resolution.avertissements.length > 0 && (
              <Callout tone="avertissement" titre="Points à vérifier">
                <ul className="space-y-1.5">
                  {resolution.avertissements.map((avertissement, i) => (
                    <li key={i}>{texteFr(avertissement)}</li>
                  ))}
                </ul>
              </Callout>
            )}
          </>
        )
      )}

      {candidats && (
        <ChoiceGroup label="Choisissez l'OPCO de l'établissement concerné">
          <div className="grid gap-2">
            {candidats.map((candidat) => (
              <ChoiceButton
                key={candidat.opcoSlug}
                label={nomOpco(candidat.opcoSlug)}
                sublabel={texteFr(candidat.idccs.map((i) => `IDCC ${i.idcc}${INSECABLE}: ${i.titre}`).join(' · '))}
                selected={state.detectedOpcoSlug === candidat.opcoSlug}
                onClick={() => onChoisirCandidat(candidat)}
              />
            ))}
          </div>
        </ChoiceGroup>
      )}

      <div className="border-t border-filet pt-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <LienOfficiel href={resolution?.urlVerificationOfficielle ?? URL_VERIFICATION_OPCO}>
            Vérifier sur l&apos;outil officiel France Compétences
          </LienOfficiel>
          <BoutonLien onClick={onToggleListe} icone="chevron" expanded={listeOuverte} controls={idListe}>
            Ce n&apos;est pas mon OPCO
          </BoutonLien>
          {choixManuel && state.detectedOpcoSlug && (
            <BoutonLien onClick={onRevenir} icone="retour">
              Revenir à l&apos;OPCO identifié
            </BoutonLien>
          )}
        </div>
        <div id={idListe}>
          {listeOuverte && (
            <ChoiceGroup label="Choisissez votre OPCO" className="mt-4">
              <OpcoPicker options={EMBEDDED_OPCO_LIST} selectedSlug={state.selectedOpcoSlug} onSelect={onChoisirOpco} />
            </ChoiceGroup>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Barèmes de branche de l'OPCO retenu : choix de la branche (ou du barème général) et précisions qui s'y rattachent. */
function BlocBranche({
  opco,
  state,
  updateState,
}: {
  opco: OpcoData;
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
}) {
  const variantes = opco.variantes_branche ?? [];
  // Barème que le moteur appliquera : le choix manuel prime, sinon la variante qui couvre l'IDCC détecté, sinon le barème général.
  const appliquee = resolveVarianteBranche(opco, state);
  const detectee = resolveVarianteBranche(opco, { selectedBrancheId: null, detectedIdcc: state.detectedIdcc });
  if (variantes.length === 0 && !opco.note_variantes) return null;

  return (
    <div className="space-y-4">
      {variantes.length > 0 && (
        <ChoiceGroup
          label="Votre accord de branche"
          aide={
            <>
              {opco.name}{' '}applique des barèmes différents selon la convention collective. Choisissez la vôtre pour
              affiner l&apos;estimation&nbsp;; sans choix, le barème de la convention détectée s&apos;applique, à
              défaut le barème général.
            </>
          }
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {variantes.map((variante) => (
              <ChoiceButton
                key={variante.id}
                label={variante.branche_nom}
                sublabel={
                  detectee?.id === variante.id ? (
                    <span className="inline-flex items-center gap-1 font-medium text-turquoise-deep">
                      <Icon name="coche" className="size-3.5 shrink-0" strokeWidth={2.5} />
                      Détectée via votre convention collective
                    </span>
                  ) : undefined
                }
                selected={appliquee?.id === variante.id}
                onClick={() => updateState({ selectedBrancheId: variante.id })}
              />
            ))}
            <ChoiceButton
              label="Barème général / je ne sais pas"
              sublabel={detectee ? 'Revient au barème détecté via votre convention collective' : undefined}
              selected={appliquee == null}
              onClick={() => updateState({ selectedBrancheId: null })}
            />
          </div>
        </ChoiceGroup>
      )}
      {opco.note_variantes && <Callout tone="info">{texteFr(opco.note_variantes)}</Callout>}
      {appliquee?.note && <Callout tone="info">{texteFr(appliquee.note)}</Callout>}
    </div>
  );
}

/** Lieu du siège d'un résultat : « BEZONS (95870) ». */
function lieuDuSiege(e: EntrepriseInfo): string {
  const { commune, codePostal } = e.siege;
  return commune && codePostal ? `${commune} (${codePostal})` : commune || codePostal;
}

export function StepIdentification({ state, updateState }: Props) {
  // Le mode survit au changement d'étape grâce à `opcoKnown` (vrai : OPCO et région saisis à la main).
  const [mode, setMode] = useState<Mode>(state.opcoKnown === true ? 'manuel' : 'recherche');
  const [recherche, setRecherche] = useState(state.companyName ?? '');
  const [codePostal, setCodePostal] = useState('');
  const [listeOpcoOuverte, setListeOpcoOuverte] = useState(false);
  const { results, loading, error, isOffline, hasSearched, search, clear } = useSirenLookup();

  // Focus : quand le contrôle qui l'a disparaît (résultat choisi, liste refermée), le titre de la carte qui le remplace
  // le reçoit, après le rendu qui l'affiche.
  const titreEntreprise = useRef<HTMLHeadingElement>(null);
  const titreOpco = useRef<HTMLHeadingElement>(null);
  const cibleFocus = useRef<CibleFocus | null>(null);
  useEffect(() => {
    const cible = cibleFocus.current;
    if (!cible) return;
    cibleFocus.current = null;
    (cible === 'entreprise' ? titreEntreprise : titreOpco).current?.focus();
  });

  // Résolution de l'OPCO recalculée depuis l'état (jamais mémorisée à part) : elle suit toujours l'entreprise affichée.
  const resolution = useMemo(
    () =>
      state.sirenNumber
        ? resoudreOpco(
            entreeDeResolution({
              idccs: state.idccEtablissements,
              idccSiege: state.idccSiege,
              codeNaf: state.codeNaf,
              natureJuridique: state.natureJuridique,
            }),
            EMBEDDED_IDCC,
            EMBEDDED_NAF,
          )
        : null,
    [state.sirenNumber, state.idccEtablissements, state.idccSiege, state.codeNaf, state.natureJuridique],
  );
  const slug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = slug ? getEmbeddedOpcoBySlug(slug) : undefined;

  const changerMode = (nouveau: Mode) => {
    if (nouveau === mode) return;
    setMode(nouveau);
    setListeOpcoOuverte(false);
    setCodePostal('');
    clear();
    if (nouveau === 'manuel' && state.sirenNumber) {
      // Passer en saisie manuelle écarte l'entreprise choisie, avec tout ce que sa recherche avait établi.
      updateState({ ...etatSansEntreprise(), opcoKnown: true });
      setRecherche('');
    } else {
      updateState({ opcoKnown: nouveau === 'manuel' });
    }
  };

  const saisirRecherche = (texte: string) => {
    setRecherche(texte);
    // Une nouvelle saisie écarte l'entreprise choisie : jamais d'IDCC ni de NAF d'une entreprise qui n'est plus celle affichée.
    updateState(
      state.sirenNumber
        ? { ...etatSansEntreprise(), companyName: texte || null }
        : { companyName: texte || null },
    );
    search(texte);
  };

  const choisirEntreprise = (entreprise: EntrepriseInfo) => {
    const resolue = resoudreOpco(entreeDeResolution(entreprise), EMBEDDED_IDCC, EMBEDDED_NAF);
    updateState(etatDepuisEntreprise(entreprise, resolue));
    setRecherche(entreprise.nom);
    setCodePostal('');
    // Aucun OPCO identifié et aucun candidat à départager : la liste des OPCO est le seul choix possible, on l'ouvre.
    setListeOpcoOuverte(resolue.opcoSlug == null && resolue.candidats.length === 0);
    clear();
    cibleFocus.current = 'entreprise';
  };

  const saisirCodePostal = (texte: string) => {
    const chiffres = texte.replace(/\D/g, '').slice(0, 5);
    setCodePostal(chiffres);
    const departement = departementDuCodePostal(chiffres);
    if (departement) updateState({ departementCode: departement, regionCode: regionDuDepartement(departement) });
  };

  // Le département connu ne vaut plus pour une autre région ; choisir de nouveau la même région ne change rien.
  const choisirRegion = (code: CodeRegion) => {
    if (code !== state.regionCode) updateState({ regionCode: code, departementCode: null });
  };

  // OPCO choisi à la main : le barème de branche choisi pour un autre OPCO ne vaut pas pour celui-ci.
  const choisirOpco = (choisi: string) => {
    updateState({
      selectedOpcoSlug: choisi,
      selectedBrancheId: choisi === state.selectedOpcoSlug ? state.selectedBrancheId : null,
    });
  };

  // Choix dans la liste « Ce n'est pas mon OPCO » : la liste se referme, le focus passe au titre de la carte OPCO.
  const choisirOpcoDansLaListe = (choisi: string) => {
    choisirOpco(choisi);
    setListeOpcoOuverte(false);
    cibleFocus.current = 'opco';
  };

  // Choix d'un OPCO parmi plusieurs possibles : l'identification reste « à confirmer », seul l'OPCO retenu change.
  const choisirCandidat = (candidat: CandidatOpco) =>
    updateState({
      detectedOpcoSlug: candidat.opcoSlug,
      detectedIdcc: candidat.idccs[0]?.idcc ?? null,
      selectedBrancheId: null,
    });

  const revenirAOpcoIdentifie = () => {
    updateState({ selectedOpcoSlug: null, selectedBrancheId: null });
    cibleFocus.current = 'opco';
  };

  const afficherCarteOpco = mode === 'recherche' && (state.sirenNumber != null || slug != null);
  const tailleSuggereeInsee =
    state.sirenNumber != null &&
    state.effectif == null &&
    state.companySize != null &&
    tailleDepuisTranche(state.trancheEffectifInsee) === state.companySize;

  return (
    <div className="space-y-8">
      <EnTeteEtape
        etape="identification"
        titre="Votre entreprise"
        chapeau="L'entreprise détermine son OPCO (opérateur de compétences) et les aides de sa région."
        obligatoires
      />

      <div className="space-y-6">
        <ChoiceGroup label="Comment renseigner votre entreprise&nbsp;?">
          <div className="grid gap-2 sm:grid-cols-2">
            <ChoiceButton
              label="Rechercher mon entreprise"
              sublabel="Par nom, SIREN ou SIRET"
              selected={mode === 'recherche'}
              onClick={() => changerMode('recherche')}
            />
            <ChoiceButton
              label="Saisir manuellement"
              sublabel="Je choisis moi-même mon OPCO et ma région"
              selected={mode === 'manuel'}
              onClick={() => changerMode('manuel')}
            />
          </div>
        </ChoiceGroup>

        {mode === 'recherche' && (
          <div className="space-y-3">
            <TextField
              label="Nom, SIREN ou SIRET de votre entreprise"
              value={recherche}
              onChange={saisirRecherche}
              placeholder="Ex&nbsp;: Carrefour ou 652 014 051"
              autoComplete="off"
              icone="loupe"
            />

            <div role="status" aria-live="polite" className="text-sm">
              {loading && (
                <p className="flex items-center gap-2.5 py-1 text-texte-doux">
                  <span
                    aria-hidden="true"
                    className="inline-block size-4 animate-spin rounded-full border-2 border-orange-deep border-t-transparent"
                  />
                  Recherche en cours…
                </p>
              )}
              {error && (
                <div className="flex items-start gap-3 rounded-champ border border-rouge/25 bg-rouge-soft px-4 py-3">
                  <Icon name="alerte" className="mt-0.5 size-5 shrink-0 text-rouge" />
                  <p className="leading-relaxed text-texte-doux">
                    <span className="font-semibold text-texte">{error}</span>
                    {isOffline && (
                      <>
                        {' '}
                        <button type="button" onClick={() => changerMode('manuel')} className="lien">
                          Saisir manuellement
                        </button>
                      </>
                    )}
                  </p>
                </div>
              )}
              {!loading && !error && hasSearched && results.length === 0 && (
                <div className="flex items-start gap-3 rounded-champ border border-filet bg-lin-soft px-4 py-3">
                  <Icon name="info" className="mt-0.5 size-5 shrink-0 text-turquoise-deep" />
                  <p className="leading-relaxed text-texte-doux">
                    <span className="font-semibold text-texte">Aucune entreprise trouvée.</span>{' '}
                    Vérifiez l&apos;orthographe ou le numéro, ou{' '}
                    <button type="button" onClick={() => changerMode('manuel')} className="lien">
                      saisissez votre entreprise manuellement
                    </button>
                    .
                  </p>
                </div>
              )}
            </div>

            {results.length > 0 && !state.sirenNumber && (
              <ul
                role="list"
                aria-label="Entreprises trouvées"
                className="max-h-[26rem] divide-y divide-filet overflow-y-auto rounded-carte border border-filet bg-white shadow-douce"
              >
                {results.map((entreprise) => {
                  const lieu = lieuDuSiege(entreprise);
                  const idccs = idccAffichables(entreprise.idccs);
                  const autres = idccs.length - IDCC_AFFICHES;
                  return (
                    <li key={entreprise.siren}>
                      <button
                        type="button"
                        onClick={() => choisirEntreprise(entreprise)}
                        className="group flex w-full items-start gap-3 px-4 py-3.5 text-left transition-[background-color] hover:bg-lin-soft focus-visible:bg-lin-soft focus-visible:outline-offset-[-3px]"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-turquoise-soft text-turquoise-deep"
                        >
                          <Icon name="batiment" className="size-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold break-words text-texte">{entreprise.nom}</span>
                          <span className="mt-0.5 block text-sm text-texte-doux">
                            {[`SIREN ${numeroLisible(entreprise.siren)}`, lieu].filter(Boolean).join(' · ')}
                          </span>
                          {idccs.length > 0 && (
                            <span className="mt-1 block text-xs font-medium text-turquoise-deep">
                              IDCC {idccs.slice(0, IDCC_AFFICHES).join(', ')}
                              {autres > 0 ? ` (+${autres})` : ''}
                            </span>
                          )}
                        </span>
                        <Icon
                          name="chevron"
                          className="mt-2 size-4 shrink-0 text-texte-discret transition-transform group-hover:translate-x-0.5"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {mode === 'manuel' && (
          <div className="space-y-6">
            <ChoiceGroup
              label={
                opcoRequis(state.projetType)
                  ? 'Votre OPCO'
                  : 'Votre OPCO (facultatif pour le projet « former le dirigeant »)'
              }
              required={opcoRequis(state.projetType)}
            >
              <OpcoPicker options={EMBEDDED_OPCO_LIST} selectedSlug={state.selectedOpcoSlug} onSelect={choisirOpco} />
              <div className="mt-2">
                <LienOfficiel href={URL_VERIFICATION_OPCO}>
                  Je ne connais pas mon OPCO&nbsp;: outil officiel France Compétences
                </LienOfficiel>
              </div>
            </ChoiceGroup>
            <TextField
              label="Code postal de l'entreprise"
              value={codePostal}
              onChange={saisirCodePostal}
              placeholder="Ex&nbsp;: 69003"
              inputMode="numeric"
              maxLength={5}
              autoComplete="off"
              largeur="courte"
              helper="Il donne le département et la région de l'entreprise."
            />
          </div>
        )}

        {mode === 'recherche' && state.sirenNumber && <CarteEntreprise state={state} titreRef={titreEntreprise} />}

        {afficherCarteOpco && (
          <CarteOpco
            state={state}
            resolution={resolution}
            titreRef={titreOpco}
            listeOuverte={listeOpcoOuverte}
            onToggleListe={() => setListeOpcoOuverte((ouverte) => !ouverte)}
            onChoisirOpco={choisirOpcoDansLaListe}
            onChoisirCandidat={choisirCandidat}
            onRevenir={revenirAOpcoIdentifie}
          />
        )}
      </div>

      <div className="space-y-6 border-t border-filet pt-8">
        <ChampRegion
          label="Région de l'entreprise"
          required
          valeur={state.regionCode}
          onChange={choisirRegion}
          aide={
            mode === 'recherche' && state.sirenNumber ? (
              <>
                Région du siège de l&apos;entreprise&nbsp;: modifiez-la si l&apos;établissement concerné est ailleurs.
              </>
            ) : undefined
          }
        />

        <ChoiceGroup
          label="Taille de l'entreprise"
          required
          aide={tailleSuggereeInsee ? "Présélectionnée d'après l'effectif déclaré à l'INSEE." : undefined}
        >
          {state.effectif != null && state.companySize ? (
            <p className="flex items-center gap-3 rounded-champ border border-filet bg-lin-soft px-4 py-3 text-sm text-texte">
              <Icon name="calculatrice" className="size-5 shrink-0 text-turquoise-deep" />
              <span>
                Tranche&nbsp;: <span className="font-semibold">{COMPANY_SIZE_LABELS[state.companySize]}</span>{' '}
                (déduite de l&apos;effectif)
              </span>
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(COMPANY_SIZE_LABELS) as [CompanySize, string][]).map(([taille, libelle]) => (
                <ChoiceButton
                  key={taille}
                  label={libelle}
                  selected={state.companySize === taille}
                  onClick={() => updateState({ companySize: taille })}
                  compact
                />
              ))}
            </div>
          )}
        </ChoiceGroup>

        <NumberField
          label="Effectif exact"
          facultatif
          value={state.effectif}
          onChange={(effectif) => updateState(etatDepuisEffectif(effectif))}
          placeholder="Ex&nbsp;: 42"
          helper="Certaines aides dépendent de seuils précis (par exemple 250&nbsp;salariés). Saisi, il fixe la tranche."
        />
      </div>

      {(ouvreBudgetOpco(state.projetType) || opco) && (
        <div className="space-y-6 border-t border-filet pt-8">
          {ouvreBudgetOpco(state.projetType) && (
            <NumberField
              label="Budget formation déjà consommé cette année auprès de votre OPCO (€)"
              facultatif
              value={state.budgetDejaConsomme}
              onChange={(budgetDejaConsomme) => updateState({ budgetDejaConsomme })}
              decimal
              euros
              placeholder="Ex&nbsp;: 1500"
              helper="Laissez vide si aucune formation financée cette année&nbsp;: ce montant est déduit de votre plafond annuel."
            />
          )}
          {opco && <BlocBranche opco={opco} state={state} updateState={updateState} />}
        </div>
      )}
    </div>
  );
}
