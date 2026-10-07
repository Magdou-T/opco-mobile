'use client';

import { useEffect, useMemo } from 'react';
import { EMBEDDED_OPCOS, PROJET_LABELS, REGIONS } from '@opco/core';
import type { WizardState } from '@opco/core';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Etiquette } from '@/components/ui/Etiquette';
import { Icon } from '@/components/ui/Icon';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { ouvreBudgetOpco } from '@/lib/entreprise';
import { dateFr, moisAnneeFr, typo } from '@/lib/format';
import { calculer, fondsEpuisesSurLePlan } from '@/lib/resultats';
import { AidesList } from './AidesList';
import { ID_TITRE_RESULTATS, TitreResultats, focaliserTitreResultats } from './EtatsResultats';
import type { ProprietesEcranResultats } from './EtatsResultats';
import { FundingBreakdown } from './FundingBreakdown';
import { PlanFinancementCard } from './PlanFinancement';
import { PortailsRegionaux } from './PortailsRegionaux';

/**
 * Écran « Votre plan de financement », chargé à la demande par le parcours (`next/dynamic`) : le catalogue d'aides
 * (environ 135 Ko gzip) et tout le calcul restent hors du lot initial du simulateur. Le parcours ne lui passe que l'état
 * et deux actions ; le calcul est une dérivation pure de l'état (aucune mise à jour d'état pendant le rendu).
 */

/** Date du jour à l'heure locale (AAAA-MM-JJ) : référence de validité des aides et date de la simulation imprimée. */
function aujourdhuiLocal(): string {
  const d = new Date();
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

/** Vérification la plus récente des barèmes des OPCO, comme le pied de page (AAAA-MM-JJ : ordre alphabétique = chronologique). */
const VERIFICATION_OPCO = EMBEDDED_OPCOS.reduce(
  (recente, o) => (o.derniere_verification && o.derniere_verification > recente ? o.derniere_verification : recente),
  '',
);

export function EcranResultats({ state, onEdit, onReset }: ProprietesEcranResultats) {
  // Le titre n'existait pas quand le parcours a affiché les résultats (code chargé à la demande) : l'écran pose le focus
  // sur son titre dès son montage.
  useEffect(focaliserTitreResultats, []);

  // Calcul (lib/resultats.ts) : dérivation pure de l'état, à la date du jour lue ici.
  const { opco, projet, funding, profil, aidesEvaluees, plan, portail, aujourdhui } = useMemo(() => {
    const jour = aujourdhuiLocal();
    return { ...calculer(state, jour), aujourdhui: jour };
  }, [state]);

  const situation = [
    PROJET_LABELS[projet].label,
    opco?.name,
    profil.regionEntreprise ? REGIONS[profil.regionEntreprise] : null,
    state.durationHours ? `${state.durationHours} h` : null,
  ].filter((e): e is string => !!e);

  // Salaires et transport de l'OPCO : aides à l'employeur dans le plan, postes du calcul dans le détail de l'OPCO.
  const postesHorsFormation = funding?.lines.some(
    (l) => (l.poste === 'salaires' || l.poste === 'transport') && l.fundedAmount > 0,
  );

  return (
    <div className="space-y-12 sm:space-y-14">
      <section aria-labelledby={ID_TITRE_RESULTATS} className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <TitreResultats chapeau={state.formationNom ? typo(`Formation : ${state.formationNom}`) : undefined} />
          {/* Sous 640 px, libellés courts sur une ligne (le nom accessible reste complet) : le bandeau monte d'autant. */}
          <div className="-ml-1 flex flex-wrap gap-x-5 print:hidden sm:ml-0 sm:shrink-0">
            <Button variant="ghost" icone="crayon" onClick={() => onEdit('recap')}>
              Modifier<span className="max-sm:sr-only"> mes informations</span>
            </Button>
            <Button variant="ghost" icone="document" onClick={() => window.print()}>
              Imprimer<span className="max-sm:sr-only"> / PDF</span>
            </Button>
          </div>
        </div>

        {situation.length > 0 && (
          <ul aria-label="Votre situation" className="flex flex-wrap gap-2">
            {situation.map((e) => (
              <Etiquette key={e} as="li">
                {typo(e)}
              </Etiquette>
            ))}
          </ul>
        )}

        <PlanFinancementCard
          plan={plan}
          aides={aidesEvaluees}
          fondsEpuises={funding ? { opco: funding.opcoName, branches: fondsEpuisesSurLePlan(plan, funding.alertes) } : null}
          apresBandeau={
            <NoteOpco
              projet={projet}
              sansOpco={!opco}
              assimileSalarie={state.statutDirigeant === 'assimile_salarie'}
              onEdit={onEdit}
            />
          }
          onModifierFormation={() => onEdit('formation')}
        />
      </section>

      <AidesList aides={aidesEvaluees} avecPortail={portail != null} />

      {funding && (
        <section aria-labelledby="titre-detail-opco" className="space-y-6">
          <SectionTitle
            as="h2"
            taille="sous-section"
            id="titre-detail-opco"
            surtitre={typo(`Votre OPCO : ${funding.opcoName}`)}
            titre="Détail de l'estimation OPCO"
            chapeau={typo(
              postesHorsFormation
                ? "Le calcul de l'OPCO poste par poste. Le plan ci-dessus ne retient que les postes de la formation : salaires et transport y figurent parmi les aides versées à l'employeur."
                : "Le calcul de l'OPCO poste par poste, avec la règle et la source de chaque montant.",
            )}
          />
          <FundingBreakdown result={funding} />
        </section>
      )}

      {portail && <PortailsRegionaux portail={portail} />}

      <div className="space-y-6 border-t border-filet pt-8">
        <div className="space-y-2">
          <p className="flex items-start gap-2.5 text-sm leading-relaxed text-texte-doux">
            <Icon name="bouclier" className="mt-0.5 size-[18px] shrink-0 text-turquoise-deep" />
            <span>
              Estimation indicative fondée sur les règles publiées par chaque financeur&nbsp;: seul le financeur décide,
              après étude du dossier.
            </span>
          </p>
          <p className="text-xs text-texte-discret">
            Simulation du {dateFr(aujourdhui)}
            {VERIFICATION_OPCO && <> · barèmes des OPCO vérifiés en {moisAnneeFr(VERIFICATION_OPCO)}</>}.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap print:hidden">
          <Button variant="secondary" icone="crayon" onClick={() => onEdit('recap')}>
            Modifier mes informations
          </Button>
          <Button onClick={onReset}>Nouvelle simulation</Button>
          <Button variant="secondary" icone="document" onClick={() => window.print()}>
            Imprimer / PDF
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Le plan ne compte pas le plan de développement des compétences de l'OPCO : soit l'OPCO d'un projet salarié manque
 * (« Aucun OPCO renseigné », avec le retour à l'étape Entreprise), soit le projet est celui du dirigeant, que ce plan ne
 * finance pas (fonds d'assurance formation ; cas de l'assimilé salarié non calculé).
 */
function NoteOpco({
  projet,
  sansOpco,
  assimileSalarie,
  onEdit,
}: {
  projet: WizardState['projetType'];
  sansOpco: boolean;
  assimileSalarie: boolean;
  onEdit: ProprietesEcranResultats['onEdit'];
}) {
  if (projet === 'formation_dirigeant') {
    return (
      <Callout tone="info" titre={sansOpco ? 'Aucun OPCO renseigné' : 'OPCO non compté pour un dirigeant'}>
        {assimileSalarie ? (
          <>
            Un dirigeant assimilé salarié peut relever du plan de développement des compétences de sa branche, que le
            simulateur ne calcule pas&nbsp;: interrogez l&apos;OPCO de l&apos;entreprise.
          </>
        ) : (
          <>
            Le plan de développement des compétences d&apos;un OPCO finance la formation des salariés. Celle d&apos;un
            dirigeant non salarié relève de son fonds d&apos;assurance formation, compté dans le plan quand il est
            identifié.
          </>
        )}
      </Callout>
    );
  }
  if (!sansOpco || !ouvreBudgetOpco(projet)) return null;
  return (
    <Callout tone="info" titre="Aucun OPCO renseigné">
      <p>
        Le plan ne compte pas encore le plan de développement des compétences de l&apos;OPCO, souvent le premier
        financeur d&apos;une formation de salarié. Indiquez l&apos;OPCO de l&apos;entreprise pour l&apos;estimer.
      </p>
      <div className="mt-3 print:hidden">
        <Button variant="secondary" icone="batiment" onClick={() => onEdit('identification')}>
          Indiquer l&apos;OPCO
        </Button>
      </div>
    </Callout>
  );
}
