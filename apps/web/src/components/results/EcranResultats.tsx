'use client';

import { useEffect, useMemo } from 'react';
import { EMBEDDED_OPCOS } from '@opco/core';
import type { WizardState } from '@opco/core';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Icon } from '@/components/ui/Icon';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { ouvreBudgetOpco } from '@/lib/entreprise';
import { dateFr, moisAnneeFr, typo } from '@/lib/format';
import { calculer, chapeauDetailOpco, fondsEpuisesSurLePlan } from '@/lib/resultats';
import { AidesList } from './AidesList';
import { EnTeteResultats, ID_TITRE_RESULTATS, focaliserTitreResultats } from './EtatsResultats';
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
  const { opco, projet, funding, aidesEvaluees, plan, portail, aujourdhui } = useMemo(() => {
    const jour = aujourdhuiLocal();
    return { ...calculer(state, jour), aujourdhui: jour };
  }, [state]);

  // Chapeau du détail de l'OPCO : seulement avec le tableau des postes (jamais quand le plan est fermé).
  const chapeauOpco = funding ? chapeauDetailOpco(funding) : null;

  return (
    <div className="space-y-12 sm:space-y-14">
      <section aria-labelledby={ID_TITRE_RESULTATS} className="space-y-6">
        {/* Même en-tête que l'attente du chargement (EtatsResultats.tsx) : rien ne bouge quand l'écran arrive. */}
        <EnTeteResultats state={state} onEdit={onEdit} />

        <PlanFinancementCard
          plan={plan}
          aides={aidesEvaluees}
          fondsEpuises={funding ? { opco: funding.opcoName, branches: fondsEpuisesSurLePlan(plan, funding.alertes) } : null}
          dispositifs={funding?.dispositifsComplementaires ?? []}
          avecPortail={portail != null}
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
            chapeau={chapeauOpco ? typo(chapeauOpco) : undefined}
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
