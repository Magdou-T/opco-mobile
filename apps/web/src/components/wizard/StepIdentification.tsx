'use client';

import { Fragment, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  COMPANY_SIZE_LABELS,
  EMBEDDED_IDCC,
  EMBEDDED_NAF,
  EMBEDDED_OPCO_LIST,
  REGIONS,
  TRANCHES_EFFECTIF_INSEE,
  URL_VERIFICATION_OPCO,
  departementDuCodePostal,
  getEmbeddedOpcoBySlug,
  regionDuDepartement,
  resolveVarianteBranche,
  resoudreOpco,
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
import { CertitudeBadge } from '@/components/ui/CertitudeBadge';
import {
  ChoiceButton,
  ChoiceGroup,
  NumberField,
  OpcoPicker,
  RegionPicker,
  TextField,
} from '@/components/ui/forms';
import { useSirenLookup } from '@/hooks/useSirenLookup';
import { etatDepuisEntreprise, etatSansEntreprise, opcoRequis, ouvreBudgetOpco } from '@/lib/entreprise';
import { texteFr } from '@/lib/format';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
}

/** Façon de renseigner l'entreprise : recherche dans la base publique, ou saisie de l'OPCO et de la région à la main. */
type Mode = 'recherche' | 'manuel';

const STATUTS_STRUCTURE: Record<TypeStructure, string> = {
  ess: 'Économie sociale et solidaire (ESS)',
  siae: "Structure d'insertion par l'activité économique (SIAE)",
  association: 'Association',
};

/** Nombre maximal d'IDCC listés sous un résultat de recherche (un grand groupe peut en déclarer des dizaines). */
const IDCC_AFFICHES = 6;

const LIEN = 'font-medium text-cobalt underline underline-offset-2 hover:text-navy';

const nomOpco = (slug: string): string => EMBEDDED_OPCO_LIST.find((o) => o.slug === slug)?.name ?? slug;

/** Lien vers un outil officiel, ouvert dans un nouvel onglet (annoncé comme tel aux lecteurs d'écran). */
function LienOfficiel({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`text-sm ${LIEN}`}>
      <span aria-hidden="true">↗ </span>
      {children}
      <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
    </a>
  );
}

/** Encadré de précision tirée des données (barème, branche) : texte déjà en JJ/MM/AAAA. */
function Precision({ children }: { children: string }) {
  return (
    <div className="rounded border border-marker bg-marker-soft px-3 py-2 text-xs leading-relaxed text-ink-soft">
      {texteFr(children)}
    </div>
  );
}

/** Ce que la recherche a établi sur l'entreprise choisie. */
function CarteEntreprise({ state }: { state: WizardState }) {
  const effectif = state.trancheEffectifInsee ? TRANCHES_EFFECTIF_INSEE[state.trancheEffectifInsee] : null;
  const lignes: [string, string | null | undefined][] = [
    ['SIREN', state.sirenNumber],
    ['SIRET du siège', state.siret],
    ['Code NAF', state.codeNaf],
    ["Effectif déclaré à l'INSEE", effectif],
    ['Statut', state.structures.map((s) => STATUTS_STRUCTURE[s]).join(', ')],
  ];
  return (
    <div className="rounded border border-rule bg-white p-4">
      <p className="marginalia">Entreprise identifiée</p>
      <h3 className="mt-1 font-display text-lg font-bold text-ink">{state.detectedCompanyName}</h3>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {lignes
          .filter(([, valeur]) => valeur)
          .map(([libelle, valeur]) => (
            <Fragment key={libelle}>
              <dt className="text-ink-soft">{libelle}</dt>
              <dd className="font-medium text-ink">{valeur}</dd>
            </Fragment>
          ))}
      </dl>
    </div>
  );
}

/**
 * OPCO retenu pour l'entreprise, avec le niveau de certitude de l'identification, ses motifs et ses avertissements.
 * `resolution` est nulle tant qu'aucune entreprise n'est choisie (l'OPCO ne peut alors venir que d'un choix manuel).
 */
function CarteOpco({
  state,
  updateState,
  resolution,
  listeOuverte,
  onToggleListe,
  onChoisirOpco,
}: {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  resolution: ResolutionOpco | null;
  listeOuverte: boolean;
  onToggleListe: () => void;
  onChoisirOpco: (slug: string) => void;
}) {
  const choixManuel = state.selectedOpcoSlug != null;
  const slug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = slug ? getEmbeddedOpcoBySlug(slug) : undefined;
  const candidats = resolution && !choixManuel && resolution.candidats.length > 1 ? resolution.candidats : null;

  // Choix d'un OPCO parmi plusieurs possibles : l'identification reste « à confirmer », seul l'OPCO retenu change.
  const choisirCandidat = (candidat: CandidatOpco) =>
    updateState({
      detectedOpcoSlug: candidat.opcoSlug,
      detectedIdcc: candidat.idccs[0]?.idcc ?? null,
      selectedBrancheId: null,
    });

  return (
    <div className="space-y-3 rounded border border-rule bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="marginalia">Votre OPCO</p>
          <h3 className="mt-1 font-display text-lg font-bold text-ink">{opco?.name ?? 'OPCO non identifié'}</h3>
          {opco?.nom_complet && <p className="text-xs text-ink-soft">{opco.nom_complet}</p>}
        </div>
        {resolution && !choixManuel && <CertitudeBadge certitude={resolution.certitude} />}
      </div>

      {choixManuel ? (
        <p className="text-sm text-ink-soft">OPCO choisi manuellement.</p>
      ) : (
        resolution && (
          <>
            <p className="text-sm leading-relaxed text-ink-soft">{texteFr(resolution.motif)}</p>
            {resolution.avertissements.length > 0 && (
              <ul className="space-y-1 rounded border border-marker bg-marker-soft px-3 py-2 text-xs leading-relaxed text-ink-soft">
                {resolution.avertissements.map((avertissement, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden="true">⚠</span>
                    <span>
                      <span className="sr-only">Avertissement : </span>
                      {texteFr(avertissement)}
                    </span>
                  </li>
                ))}
              </ul>
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
                sublabel={texteFr(candidat.idccs.map((i) => `IDCC ${i.idcc} — ${i.titre}`).join(' · '))}
                selected={state.detectedOpcoSlug === candidat.opcoSlug}
                onClick={() => choisirCandidat(candidat)}
              />
            ))}
          </div>
        </ChoiceGroup>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <LienOfficiel href={resolution?.urlVerificationOfficielle ?? URL_VERIFICATION_OPCO}>
          Vérifier sur l&apos;outil officiel France Compétences
        </LienOfficiel>
        <button
          type="button"
          onClick={onToggleListe}
          aria-expanded={listeOuverte}
          className={`text-sm ${LIEN}`}
        >
          Ce n&apos;est pas mon OPCO
        </button>
        {choixManuel && resolution && (
          <button
            type="button"
            onClick={() => updateState({ selectedOpcoSlug: null, selectedBrancheId: null })}
            className={`text-sm ${LIEN}`}
          >
            Revenir à l&apos;OPCO identifié
          </button>
        )}
      </div>

      {listeOuverte && (
        <ChoiceGroup label="Choisissez votre OPCO">
          <OpcoPicker options={EMBEDDED_OPCO_LIST} selectedSlug={state.selectedOpcoSlug} onSelect={onChoisirOpco} />
        </ChoiceGroup>
      )}
    </div>
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
    <div className="space-y-3">
      {variantes.length > 0 && (
        <ChoiceGroup label="Votre accord de branche">
          <p className="text-xs text-ink-soft">
            {opco.name}{' '}applique des barèmes différents selon la convention collective. Choisissez la vôtre pour
            affiner l&apos;estimation ; sans choix, le barème de la convention détectée s&apos;applique, à défaut le
            barème général.
          </p>
          <div className="grid gap-2">
            {variantes.map((variante) => (
              <ChoiceButton
                key={variante.id}
                label={
                  <>
                    {appliquee?.id === variante.id && <span aria-hidden="true">✓ </span>}
                    {variante.branche_nom}
                  </>
                }
                sublabel={
                  detectee?.id === variante.id ? (
                    <span className="inline-block rounded-full border border-valid bg-white px-2 py-0.5 font-medium text-valid">
                      détectée via votre convention collective
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
      {opco.note_variantes && <Precision>{opco.note_variantes}</Precision>}
      {appliquee?.note && <Precision>{appliquee.note}</Precision>}
    </div>
  );
}

export function StepIdentification({ state, updateState }: Props) {
  // Le mode survit au changement d'étape grâce à `opcoKnown` (vrai : OPCO et région saisis à la main).
  const [mode, setMode] = useState<Mode>(state.opcoKnown === true ? 'manuel' : 'recherche');
  const [recherche, setRecherche] = useState(state.companyName ?? '');
  const [codePostal, setCodePostal] = useState('');
  const [regionOuverte, setRegionOuverte] = useState(false);
  const [listeOpcoOuverte, setListeOpcoOuverte] = useState(false);
  const { results, loading, error, isOffline, hasSearched, search, clear } = useSirenLookup();

  // Résolution de l'OPCO recalculée depuis l'état (jamais mémorisée à part) : elle suit toujours l'entreprise affichée.
  const resolution = useMemo(
    () =>
      state.sirenNumber
        ? resoudreOpco(
            { idccs: state.idccEtablissements, idccSiege: state.idccSiege, codeNaf: state.codeNaf },
            EMBEDDED_IDCC,
            EMBEDDED_NAF,
          )
        : null,
    [state.sirenNumber, state.idccEtablissements, state.idccSiege, state.codeNaf],
  );
  const slug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = slug ? getEmbeddedOpcoBySlug(slug) : undefined;

  const changerMode = (nouveau: Mode) => {
    if (nouveau === mode) return;
    setMode(nouveau);
    setListeOpcoOuverte(false);
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
    const resolue = resoudreOpco(
      { idccs: entreprise.idccs, idccSiege: entreprise.idccSiege, codeNaf: entreprise.codeNaf },
      EMBEDDED_IDCC,
      EMBEDDED_NAF,
    );
    updateState(etatDepuisEntreprise(entreprise, resolue, state.companySize));
    setRecherche(entreprise.nom);
    // Aucun OPCO identifié et aucun candidat à départager : la liste des OPCO est le seul choix possible, on l'ouvre.
    setListeOpcoOuverte(resolue.opcoSlug == null && resolue.candidats.length === 0);
    setRegionOuverte(false);
    clear();
  };

  const saisirCodePostal = (texte: string) => {
    const chiffres = texte.replace(/\D/g, '').slice(0, 5);
    setCodePostal(chiffres);
    const departement = departementDuCodePostal(chiffres);
    if (departement) updateState({ departementCode: departement, regionCode: regionDuDepartement(departement) });
  };

  const choisirRegion = (code: CodeRegion) => {
    // Le département connu ne vaut pas forcément pour la région choisie.
    updateState({ regionCode: code, departementCode: null });
    setRegionOuverte(false);
  };

  // OPCO choisi à la main : le barème de branche choisi pour un autre OPCO ne vaut pas pour celui-ci.
  const choisirOpco = (choisi: string) => {
    updateState({
      selectedOpcoSlug: choisi,
      selectedBrancheId: choisi === state.selectedOpcoSlug ? state.selectedBrancheId : null,
    });
    setListeOpcoOuverte(false);
  };

  const afficherCarteOpco = mode === 'recherche' && (state.sirenNumber != null || slug != null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-ink mb-2">Votre entreprise</h2>
        <p className="text-ink-soft text-sm">
          L&apos;entreprise détermine son OPCO (opérateur de compétences) et les aides de sa région.
        </p>
      </div>

      <ChoiceGroup label="Comment renseigner votre entreprise ?">
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
            placeholder="Ex : Carrefour ou 652 014 051"
            autoComplete="off"
          />

          <div role="status" aria-live="polite" className="text-sm">
            {loading && (
              <p className="flex items-center gap-2 text-ink-soft">
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-cobalt border-t-transparent"
                  aria-hidden="true"
                />
                Recherche en cours…
              </p>
            )}
            {error && (
              <p className="text-alert">
                {error}
                {isOffline && (
                  <>
                    {' '}
                    <button type="button" onClick={() => changerMode('manuel')} className={LIEN}>
                      Saisir manuellement
                    </button>
                  </>
                )}
              </p>
            )}
            {!loading && !error && hasSearched && results.length === 0 && (
              <p className="text-ink-soft">
                Aucune entreprise trouvée. Vérifiez l&apos;orthographe ou le numéro, ou{' '}
                <button type="button" onClick={() => changerMode('manuel')} className={LIEN}>
                  saisissez votre entreprise manuellement
                </button>
                .
              </p>
            )}
          </div>

          {results.length > 0 && !state.sirenNumber && (
            <ul
              aria-label="Entreprises trouvées"
              className="max-h-72 divide-y divide-rule overflow-y-auto rounded border border-rule bg-white"
            >
              {results.map((entreprise) => {
                const lieu =
                  entreprise.siege.commune && entreprise.siege.codePostal
                    ? `${entreprise.siege.commune} (${entreprise.siege.codePostal})`
                    : entreprise.siege.commune || entreprise.siege.codePostal;
                const idccs = entreprise.idccs.slice(0, IDCC_AFFICHES).join(', ');
                const autres = entreprise.idccs.length - IDCC_AFFICHES;
                return (
                  <li key={entreprise.siren}>
                    <button
                      type="button"
                      onClick={() => choisirEntreprise(entreprise)}
                      className="w-full px-4 py-3 text-left transition-colors hover:bg-cobalt-soft"
                    >
                      <span className="block font-medium text-ink">{entreprise.nom}</span>
                      <span className="mt-0.5 block text-xs text-ink-soft">
                        {['SIREN ' + entreprise.siren, lieu].filter(Boolean).join(' — ')}
                      </span>
                      {entreprise.idccs.length > 0 && (
                        <span className="mt-0.5 block text-xs font-medium text-valid">
                          IDCC {idccs}
                          {autres > 0 ? ` (+${autres})` : ''}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {mode === 'manuel' && (
        <div className="space-y-5">
          <ChoiceGroup
            label={
              opcoRequis(state.projetType)
                ? 'Votre OPCO'
                : 'Votre OPCO (facultatif pour le projet « former le dirigeant »)'
            }
            required={opcoRequis(state.projetType)}
          >
            <OpcoPicker options={EMBEDDED_OPCO_LIST} selectedSlug={state.selectedOpcoSlug} onSelect={choisirOpco} />
            <LienOfficiel href={URL_VERIFICATION_OPCO}>
              Je ne connais pas mon OPCO : outil officiel France Compétences
            </LienOfficiel>
          </ChoiceGroup>
          <TextField
            label="Code postal de l'entreprise"
            value={codePostal}
            onChange={saisirCodePostal}
            placeholder="Ex : 69003"
            inputMode="numeric"
            maxLength={5}
            autoComplete="postal-code"
            helper="Il donne le département et la région de l'entreprise."
          />
        </div>
      )}

      {mode === 'recherche' && state.sirenNumber && <CarteEntreprise state={state} />}

      {afficherCarteOpco && (
        <CarteOpco
          state={state}
          updateState={updateState}
          resolution={resolution}
          listeOuverte={listeOpcoOuverte}
          onToggleListe={() => setListeOpcoOuverte((ouverte) => !ouverte)}
          onChoisirOpco={choisirOpco}
        />
      )}

      <ChoiceGroup label="Région de l'entreprise" required>
        {state.regionCode && !regionOuverte ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-rule bg-white px-4 py-3">
            <span className="font-medium text-ink">{REGIONS[state.regionCode]}</span>
            <button
              type="button"
              onClick={() => setRegionOuverte(true)}
              aria-label="Modifier la région"
              className={`text-sm ${LIEN}`}
            >
              Modifier
            </button>
          </div>
        ) : (
          <RegionPicker selected={state.regionCode} onSelect={choisirRegion} />
        )}
      </ChoiceGroup>

      <ChoiceGroup label="Taille de l'entreprise" required>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(COMPANY_SIZE_LABELS) as [CompanySize, string][]).map(([taille, libelle]) => (
            <ChoiceButton
              key={taille}
              label={libelle}
              selected={state.companySize === taille}
              onClick={() => updateState({ companySize: taille })}
            />
          ))}
        </div>
      </ChoiceGroup>

      <NumberField
        label="Effectif exact (facultatif)"
        value={state.effectif}
        onChange={(effectif) => updateState({ effectif })}
        placeholder="Ex : 42"
        helper="Certaines aides dépendent de seuils précis (par exemple 250 salariés)."
      />

      {ouvreBudgetOpco(state.projetType) && (
        <NumberField
          label="Budget formation déjà consommé cette année auprès de votre OPCO (€)"
          value={state.budgetDejaConsomme}
          onChange={(budgetDejaConsomme) => updateState({ budgetDejaConsomme })}
          decimal
          placeholder="Ex : 1500"
          helper="Laissez vide si aucune formation financée cette année : ce montant est déduit de votre plafond annuel."
        />
      )}

      {opco && <BlocBranche opco={opco} state={state} updateState={updateState} />}
    </div>
  );
}
