'use client';

import { useEffect, useMemo } from 'react';
import { EMBEDDED_OPCOS } from '@opco/core';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Icon } from '@/components/ui/Icon';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { dateFr, moisAnneeFr, typo, verificationLaPlusRecente } from '@/lib/format';
import { ID_DETAIL_OPCO, fondsEpuisesSurLePlan, planFermeDe } from '@/lib/encadres-resultats';
import {
  calculer,
  chapeauDetailOpco,
  libellesDesProfils,
  mentionOpcoDuGroupe,
  notesOpco,
  relaisDuPlanConventionnel,
} from '@/lib/resultats';
import type { NoteOpco } from '@/lib/resultats';
import { AidesList } from './AidesList';
import { EnTeteResultats, ID_TITRE_RESULTATS, focaliserTitreResultats } from './EtatsResultats';
import type { ProprietesEcranResultats } from './EtatsResultats';
import { FundingBreakdown } from './FundingBreakdown';
import { ParProfil } from './ParProfil';
import { PlanFinancementCard } from './PlanFinancement';
import { PortailsRegionaux } from './PortailsRegionaux';

/**
 * Écran « Votre plan de financement », chargé à la demande par le parcours (`next/dynamic`) : le catalogue d'aides
 * (environ 149 Ko gzip) et tout le calcul restent hors du lot initial du simulateur. Le parcours ne lui passe que l'état
 * et deux actions ; le calcul est une dérivation pure de l'état (aucune mise à jour d'état pendant le rendu). Un groupe de
 * plusieurs personnes ajoute à l'écran le détail par profil, les mentions « pour N personnes » et le bloc « Concerne » des
 * aides ; pour une personne seule, l'écran est celui d'avant les groupes.
 */

/** Date du jour à l'heure locale (AAAA-MM-JJ) : référence de validité des aides et date de la simulation imprimée. */
function aujourdhuiLocal(): string {
  const d = new Date();
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

/** Vérification la plus récente des barèmes des OPCO, la même que le pied de page. */
const VERIFICATION_OPCO = verificationLaPlusRecente(EMBEDDED_OPCOS);

export function EcranResultats({ state, onEdit, onReset }: ProprietesEcranResultats) {
  // Le titre n'existait pas quand le parcours a affiché les résultats (code chargé à la demande) : l'écran pose le focus
  // sur son titre dès son montage.
  useEffect(focaliserTitreResultats, []);

  // Calcul (lib/resultats.ts) : dérivation pure de l'état, à la date du jour lue ici.
  const { opco, funding, variante, aidesEvaluees, plan, portail, groupe, aujourdhui } = useMemo(() => {
    const jour = aujourdhuiLocal();
    return { ...calculer(state, jour), aujourdhui: jour };
  }, [state]);

  // Chapeau du détail de l'OPCO : seulement avec le tableau des postes (jamais quand le plan est fermé), suivi, pour un
  // groupe, de pour qui le calcul est fait.
  const chapeauOpco = funding ? chapeauDetailOpco(funding) : null;
  const mentionGroupe = mentionOpcoDuGroupe(groupe.personnesPdc, groupe.personnes);
  const chapeauDetail = [chapeauOpco, mentionGroupe].filter((t): t is string => t != null).join(' ');
  // Plan conventionnel de la branche en relais d'un plan de développement des compétences épuisé (AKTO, organismes de
  // formation) ; plan fermé aux 50 salariés et plus. Le bandeau dit l'un et l'autre.
  const relais = relaisDuPlanConventionnel({ funding, variante });
  const profils = groupe.blocs.map((b) => b.profil);
  const libelles = libellesDesProfils(profils);
  const notes = notesOpco(
    profils.map((p) => p.champs.projetType),
    !opco,
  );
  const assimileSalarie = profils.some(
    (p) => p.champs.projetType === 'formation_dirigeant' && p.champs.statutDirigeant === 'assimile_salarie',
  );

  return (
    <div className="space-y-12 sm:space-y-14">
      <section aria-labelledby={ID_TITRE_RESULTATS} className="space-y-6">
        {/* Même en-tête que l'attente du chargement (EtatsResultats.tsx) : rien ne bouge quand l'écran arrive. */}
        <EnTeteResultats state={state} onEdit={onEdit} />

        <PlanFinancementCard
          plan={plan}
          aides={aidesEvaluees}
          personnes={groupe.personnes}
          fondsEpuises={funding ? { opco: funding.opcoName, branches: fondsEpuisesSurLePlan(plan, funding.alertes) } : null}
          relais={relais}
          planFerme={planFermeDe(funding)}
          dispositifs={funding?.dispositifsComplementaires ?? []}
          avecPortail={portail != null}
          apresBandeau={<NotesOpco notes={notes} assimileSalarie={assimileSalarie} onEdit={onEdit} />}
          onModifierFormation={() => onEdit('formation')}
        />
      </section>

      <ParProfil blocs={groupe.blocs} />

      <AidesList aides={aidesEvaluees} avecPortail={portail != null} personnes={groupe.personnes} libelles={libelles} />

      {funding && (
        <section aria-labelledby={ID_DETAIL_OPCO} className="space-y-6">
          <SectionTitle
            as="h2"
            taille="sous-section"
            id={ID_DETAIL_OPCO}
            surtitre={typo(`Votre OPCO : ${funding.opcoName}`)}
            titre="Détail de l'estimation OPCO"
            chapeau={chapeauDetail ? typo(chapeauDetail) : undefined}
          />
          <FundingBreakdown result={funding} relais={relais} />
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
 * Notes posées sous le bandeau quand le plan ne compte pas le plan de développement des compétences de l'OPCO pour tout ou
 * partie du groupe (`notesOpco`, chaque note une fois) : soit l'OPCO d'un projet salarié manque (« Aucun OPCO renseigné »,
 * avec le retour à l'étape Entreprise), soit le groupe compte un dirigeant, que ce plan ne finance pas (fonds d'assurance
 * formation ; cas de l'assimilé salarié non calculé).
 */
function NotesOpco({
  notes,
  assimileSalarie,
  onEdit,
}: {
  notes: readonly NoteOpco[];
  assimileSalarie: boolean;
  onEdit: ProprietesEcranResultats['onEdit'];
}) {
  return (
    <>
      {notes.map((note) =>
        note.genre === 'dirigeant' ? (
          <Callout key={note.genre} tone="info" titre={note.titre}>
            {assimileSalarie ? (
              <>
                Un dirigeant assimilé salarié peut relever du plan de développement des compétences de sa branche, que le
                simulateur ne calcule pas&nbsp;: interrogez l&apos;OPCO de l&apos;entreprise.
              </>
            ) : (
              <>
                Le plan de développement des compétences d&apos;un OPCO finance la formation des salariés. Celle d&apos;un
                dirigeant non salarié relève de son fonds d&apos;assurance formation, compté dans le plan quand son aide
                est éligible.
              </>
            )}
          </Callout>
        ) : (
          <Callout key={note.genre} tone="info" titre={note.titre}>
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
        ),
      )}
    </>
  );
}
