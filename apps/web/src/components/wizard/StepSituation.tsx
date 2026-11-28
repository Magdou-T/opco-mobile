'use client';

import { useEffect, useRef, useState } from 'react';
import { ID_PROFIL_PRINCIPAL, MAX_PERSONNES, MAX_PROFILS, STATUT_PAR_PROJET, nombreDePersonnes, profilsDuGroupe } from '@opco/core';
import type { ProfilDuGroupe, StatutBeneficiaire, WizardState } from '@opco/core';
import { Button } from '@/components/ui/Button';
import type { ActionsDuGroupe } from '@/hooks/useWizard';
import { manquantsDuProfil } from '@/lib/etapes';
import { nombreEtUnite } from '@/lib/format';
import { prochainIdProfil } from '@/lib/groupe';
import type { InconnuesParProfil } from '@/lib/groupe';
import { INSECABLE } from '@/lib/insecable';
import type { QuestionAvecInconnu } from '@/lib/parcours';
import { pucesDuProfil } from '@/lib/profils';
import { CarteProfil, idTitreProfil } from './CarteProfil';
import { CompteurPersonnes } from './CompteurPersonnes';
import { EnTeteEtape } from './EnTeteEtape';
import { FormulaireProfil } from './FormulaireProfil';

interface Props {
  state: WizardState;
  /** Questions auxquelles l'utilisateur a répondu « Je ne sais pas » (profil principal et formation ; la valeur reste null). */
  reponsesInconnues: ReadonlySet<QuestionAvecInconnu>;
  /** Les mêmes réponses pour chaque profil supplémentaire. */
  inconnuesProfils: InconnuesParProfil;
  /** Actions du groupe ; `repondreProfil` couvre aussi le profil principal (identifiant `principal`). */
  groupe: ActionsDuGroupe;
}

/** Titre et introduction de l'étape pour une seule personne, selon le statut du projet. */
const ENTETES: Record<StatutBeneficiaire, { titre: string; chapeau: string }> = {
  salarie: {
    titre: 'Le salarié concerné',
    chapeau: "Ces informations déterminent les aides ouvertes au salarié et à l'entreprise.",
  },
  demandeur_emploi: {
    titre: 'La personne à recruter',
    chapeau: "Les aides au recrutement dépendent de la situation du demandeur d'emploi.",
  },
  alternant: {
    titre: "L'alternant",
    chapeau: "Le type de contrat et l'âge conditionnent la plupart des aides à l'alternance.",
  },
  dirigeant: {
    titre: 'Le dirigeant',
    chapeau: 'Le statut du dirigeant détermine son fonds de formation et ses avantages fiscaux.',
  },
};

/** Introduction de l'étape dès qu'il y a plusieurs personnes ou plusieurs profils. */
const CHAPEAU_GROUPE = `Indiquez combien de personnes suivent la formation. Ajoutez un profil quand certaines ont une situation différente${INSECABLE}: statut, contrat, âge, handicap ou solde CPF.`;

const AUCUNE_REPONSE: ReadonlySet<QuestionAvecInconnu> = new Set();
const ID_AJOUT = 'ajouter-profil';

/**
 * Étape 3 : les personnes formées. Avec un seul profil, l'étape garde son allure d'une personne seule (les questions du
 * statut) et ajoute un compteur et le bouton « Ajouter un profil différent ». Dès qu'il y a plusieurs profils, une carte
 * par profil (statut, compteur, questions) ; un seul profil est déplié à la fois. À l'ajout d'un profil, le focus va à son
 * titre ; au retrait, au titre du profil précédent (ou au bouton d'ajout quand il ne reste qu'un profil). Une zone polie
 * annonce le nombre de personnes.
 */
export function StepSituation({ state, reponsesInconnues, inconnuesProfils, groupe }: Props) {
  const profils = profilsDuGroupe(state);
  const total = nombreDePersonnes(state);
  const [ouvert, setOuvert] = useState(ID_PROFIL_PRINCIPAL);
  const [annonce, setAnnonce] = useState('');
  // Élément qui prend le focus au rendu qui suit un ajout ou un retrait : le titre d'un profil, ou le bouton d'ajout.
  const aFocaliser = useRef<string | null>(null);
  useEffect(() => {
    if (aFocaliser.current) {
      document.getElementById(aFocaliser.current)?.focus();
      aFocaliser.current = null;
    }
  });

  const limite =
    profils.length >= MAX_PROFILS
      ? `Le groupe compte déjà ${MAX_PROFILS}${INSECABLE}profils, le maximum.`
      : total >= MAX_PERSONNES
        ? `Le groupe compte déjà ${MAX_PERSONNES}${INSECABLE}personnes, le maximum.`
        : null;

  const ajouter = () => {
    if (limite) return;
    const id = prochainIdProfil(state);
    groupe.ajouterProfil();
    setOuvert(id);
    aFocaliser.current = idTitreProfil(id);
    setAnnonce(`Profil ${profils.length + 1} ajouté. ${nombreEtUnite(total + 1, 'personnes')} au total.`);
  };

  const retirer = (id: string, rang: number) => {
    const retire = profils.find((p) => p.id === id);
    if (!retire) return;
    const precedent = profils[rang - 2]?.id ?? ID_PROFIL_PRINCIPAL;
    groupe.retirerProfil(id);
    if (ouvert === id) setOuvert(precedent);
    aFocaliser.current = profils.length === 2 ? ID_AJOUT : idTitreProfil(precedent);
    const reste = total - retire.nombre;
    setAnnonce(`Profil ${rang} retiré. ${nombreEtUnite(reste, reste > 1 ? 'personnes' : 'personne')} au total.`);
  };

  const formulaire = (profil: ProfilDuGroupe) => (
    <FormulaireProfil
      champs={profil.champs}
      nombre={profil.nombre}
      regionEntreprise={state.regionCode}
      maj={(maj) => groupe.majProfil(profil.id, maj)}
      inconnues={profil.principal ? reponsesInconnues : (inconnuesProfils[profil.id] ?? AUCUNE_REPONSE)}
      repondre={(question, valeur) => groupe.repondreProfil(profil.id, question, valeur)}
      changerProjet={profil.principal ? undefined : (projet) => groupe.changerProjetProfil(profil.id, projet)}
    />
  );

  const boutonAjout = (
    <div>
      <Button
        id={ID_AJOUT}
        variant="secondary"
        icone="recrutement"
        onClick={limite ? undefined : ajouter}
        aria-disabled={limite != null || undefined}
        aria-describedby={limite ? 'aide-ajouter-profil' : undefined}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
      >
        Ajouter un profil différent
      </Button>
      {limite && (
        <p id="aide-ajouter-profil" className="mt-2 text-sm text-texte-discret">
          {limite}
        </p>
      )}
    </div>
  );
  const zoneAnnonce = (
    <p role="status" className="sr-only">
      {annonce}
    </p>
  );

  if (profils.length === 1) {
    const principal = profils[0];
    const entete = ENTETES[STATUT_PAR_PROJET[principal.champs.projetType ?? 'formation_salarie']];
    return (
      <div className="space-y-8">
        <EnTeteEtape
          etape="situation"
          titre={total > 1 ? 'Les personnes formées' : entete.titre}
          chapeau={total > 1 ? CHAPEAU_GROUPE : entete.chapeau}
          obligatoires
        />
        <CompteurPersonnes
          label="Nombre de personnes"
          aide="Indiquez combien de personnes suivent cette formation. Si certaines ont une situation différente, ajoutez ensuite un profil."
          valeur={principal.nombre}
          max={MAX_PERSONNES}
          onChange={(n) => groupe.definirNombre(ID_PROFIL_PRINCIPAL, n)}
        />
        <div className="border-t border-filet pt-8">{formulaire(principal)}</div>
        {boutonAjout}
        {zoneAnnonce}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <EnTeteEtape etape="situation" titre="Les personnes formées" chapeau={CHAPEAU_GROUPE} obligatoires />
      <ul role="list" className="space-y-4">
        {profils.map((profil, i) => {
          const rang = i + 1;
          return (
            <li key={profil.id}>
              <CarteProfil
                profil={profil}
                rang={rang}
                puces={pucesDuProfil(profil.champs)}
                manquants={manquantsDuProfil(profil.champs)}
                ouvert={ouvert === profil.id}
                onBasculer={() => setOuvert(ouvert === profil.id ? '' : profil.id)}
                onNombre={(n) => groupe.definirNombre(profil.id, n)}
                max={MAX_PERSONNES - (total - profil.nombre)}
                onRetirer={profil.principal ? undefined : () => retirer(profil.id, rang)}
              >
                {formulaire(profil)}
              </CarteProfil>
            </li>
          );
        })}
      </ul>
      {boutonAjout}
      <p className="text-sm font-semibold text-texte">
        {nombreEtUnite(total, 'personnes')} · {nombreEtUnite(profils.length, 'profils')}
      </p>
      {zoneAnnonce}
    </div>
  );
}
