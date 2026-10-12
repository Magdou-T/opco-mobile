'use client';

import {
  CONTRACT_TYPE_LABELS,
  NIVEAU_DIPLOME_LABELS,
  REGIONS,
  STATUT_DIRIGEANT_LABELS,
  STATUT_PAR_PROJET,
  TYPE_ALTERNANCE_LABELS,
} from '@opco/core';
import type {
  ChampsProfil,
  CodeRegion,
  ContractType,
  NiveauDiplome,
  ProjetType,
  StatutBeneficiaire,
  StatutDirigeant,
  TypeAlternance,
} from '@opco/core';
import { ChampRegion, CheckboxRow, ChoiceButton, ChoiceGroup, NumberField, OuiNonChoix } from '@/components/ui/forms';
import { INSECABLE } from '@/lib/insecable';
import type { QuestionAvecInconnu, QuestionDeProfil } from '@/lib/parcours';
import { STATUT_DU_PROFIL } from '@/lib/profils';

interface Props {
  champs: ChampsProfil;
  /** Nombre de personnes de ce profil : au-delà d'une, les réponses valent pour chacune. */
  nombre: number;
  /** Région de l'entreprise : région de résidence par défaut. */
  regionEntreprise: CodeRegion | null;
  maj: (updates: Partial<ChampsProfil>) => void;
  /** Questions auxquelles l'utilisateur a répondu « Je ne sais pas » (la valeur reste null). */
  inconnues: ReadonlySet<QuestionAvecInconnu>;
  repondre: <K extends QuestionDeProfil>(question: K, valeur: ChampsProfil[K]) => void;
  /** Profil supplémentaire : le statut se choisit ici (le profil principal a choisi son projet à l'étape 1). */
  changerProjet?: (projet: ProjetType) => void;
}

/** Libellé de l'âge selon la personne concernée par le projet. */
const LIBELLE_AGE: Record<StatutBeneficiaire, string> = {
  salarie: 'Âge du salarié',
  demandeur_emploi: 'Âge de la personne',
  alternant: "Âge de l'alternant",
  dirigeant: 'Âge du dirigeant',
};

/** Contrats proposés au salarié : l'alternance est un projet à part entière. */
const CONTRATS_SALARIE = (Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][]).filter(
  ([contrat]) => contrat !== 'alternance',
);

/**
 * Région de résidence (demandeur d'emploi, alternant) : les aides régionales dépendent de la région où vit la
 * personne, pas de celle de l'entreprise. Par défaut, celle de l'entreprise (le moteur fait de même).
 */
function RegionDeResidence({
  label,
  champs,
  regionEntreprise,
  maj,
}: {
  label: string;
  champs: ChampsProfil;
  regionEntreprise: CodeRegion | null;
  maj: (updates: Partial<ChampsProfil>) => void;
}) {
  return (
    <ChampRegion
      label={label}
      valeur={champs.regionBeneficiaireCode ?? regionEntreprise}
      onChange={(code: CodeRegion) => maj({ regionBeneficiaireCode: code })}
      aide={regionEntreprise ? `Par défaut, celle de l'entreprise (${REGIONS[regionEntreprise]}).` : undefined}
    />
  );
}

/**
 * Les questions d'un profil : statut (profil supplémentaire seulement), questions propres au statut, puis âge, diplôme,
 * RQTH et solde CPF. Les mêmes pour le profil principal et pour les profils supplémentaires.
 */
export function FormulaireProfil({ champs, nombre, regionEntreprise, maj, inconnues, repondre, changerProjet }: Props) {
  const projet = champs.projetType ?? 'formation_salarie';
  const statut = STATUT_PAR_PROJET[projet];
  const avecSoldeCpf = statut === 'salarie' || statut === 'dirigeant';

  return (
    <div className="space-y-8">
      {nombre > 1 && (
        <p className="text-sm leading-relaxed text-texte-doux">
          {`Ces réponses valent pour chacune des ${nombre}${INSECABLE}personnes de ce profil. Si elles diffèrent (âge, contrat, handicap, solde CPF), ajoutez un profil.`}
        </p>
      )}

      {changerProjet && (
        <ChoiceGroup label="Statut de ces personnes" required>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(STATUT_DU_PROFIL) as ProjetType[]).map((p) => (
              <ChoiceButton key={p} label={STATUT_DU_PROFIL[p]} selected={projet === p} onClick={() => changerProjet(p)} compact />
            ))}
          </div>
        </ChoiceGroup>
      )}

      <div className="space-y-7">
        {statut === 'salarie' && (
          <>
            <ChoiceGroup label="Type de contrat" required>
              <div className="grid gap-2 sm:grid-cols-3">
                {CONTRATS_SALARIE.map(([contrat, libelle]) => (
                  <ChoiceButton
                    key={contrat}
                    label={libelle}
                    selected={champs.contractType === contrat}
                    onClick={() => maj({ contractType: contrat })}
                    compact
                  />
                ))}
              </div>
            </ChoiceGroup>
            <NumberField
              label="Ancienneté dans l'entreprise (en mois)"
              required={projet === 'reconversion_salarie'}
              facultatif={projet !== 'reconversion_salarie'}
              value={champs.anciennete_mois}
              onChange={(anciennete_mois) => maj({ anciennete_mois })}
              placeholder="Ex&nbsp;: 24"
            />
          </>
        )}

        {statut === 'demandeur_emploi' && (
          <>
            <OuiNonChoix
              label="Inscrit(e) à France Travail"
              value={champs.inscritFranceTravail}
              onChange={(inscritFranceTravail) => repondre('inscritFranceTravail', inscritFranceTravail)}
              required
            />
            <RegionDeResidence label="Région de résidence" champs={champs} regionEntreprise={regionEntreprise} maj={maj} />
          </>
        )}

        {statut === 'alternant' && (
          <>
            <ChoiceGroup label="Type de contrat" required>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.entries(TYPE_ALTERNANCE_LABELS) as [TypeAlternance, string][]).map(([type, libelle]) => (
                  <ChoiceButton
                    key={type}
                    label={libelle}
                    selected={champs.typeAlternance === type}
                    onClick={() => maj({ typeAlternance: type, contractType: 'alternance' })}
                  />
                ))}
              </div>
            </ChoiceGroup>
            <OuiNonChoix
              label="Actuellement inscrit(e) à France Travail"
              value={champs.inscritFranceTravail}
              inconnu={inconnues.has('inscritFranceTravail')}
              onChange={(inscritFranceTravail) => repondre('inscritFranceTravail', inscritFranceTravail)}
              avecInconnu
            />
            <RegionDeResidence
              label="Région de résidence de l'alternant"
              champs={champs}
              regionEntreprise={regionEntreprise}
              maj={maj}
            />
          </>
        )}

        {statut === 'dirigeant' && (
          <>
            <ChoiceGroup label="Statut du dirigeant" required>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.entries(STATUT_DIRIGEANT_LABELS) as [StatutDirigeant, string][]).map(([s, libelle]) => (
                  <ChoiceButton
                    key={s}
                    label={libelle}
                    selected={champs.statutDirigeant === s}
                    onClick={() => maj({ statutDirigeant: s })}
                  />
                ))}
              </div>
            </ChoiceGroup>
            <OuiNonChoix
              label="Micro-entrepreneur"
              value={champs.microEntrepreneur}
              inconnu={inconnues.has('microEntrepreneur')}
              onChange={(microEntrepreneur) => repondre('microEntrepreneur', microEntrepreneur)}
              avecInconnu
            />
          </>
        )}
      </div>

      <div className="space-y-7 border-t border-filet pt-8">
        <NumberField
          label={LIBELLE_AGE[statut]}
          required={statut === 'alternant'}
          facultatif={statut !== 'alternant'}
          value={champs.ageBeneficiaire}
          onChange={(ageBeneficiaire) => maj({ ageBeneficiaire })}
          min={14}
          max={99}
          placeholder="Ex&nbsp;: 19"
        />

        <ChoiceGroup label="Diplôme le plus élevé" facultatif>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.entries(NIVEAU_DIPLOME_LABELS) as [NiveauDiplome, string][]).map(([niveau, libelle]) => (
              <ChoiceButton
                key={niveau}
                label={libelle}
                selected={champs.niveauDiplome === niveau}
                // Choix facultatif : un second clic le retire.
                onClick={() => maj({ niveauDiplome: champs.niveauDiplome === niveau ? null : niveau })}
                compact
              />
            ))}
          </div>
        </ChoiceGroup>

        <CheckboxRow
          label="Reconnaissance de travailleur handicapé (RQTH ou équivalent)"
          description="Ouvre droit à des aides spécifiques (Agefiph, CPF majoré…)"
          checked={champs.isHandicap}
          onToggle={(isHandicap) => maj({ isHandicap })}
        />

        {avecSoldeCpf && (
          <NumberField
            label="Solde CPF (€)"
            facultatif
            decimal
            euros
            value={champs.soldeCpf}
            onChange={(soldeCpf) => maj({ soldeCpf })}
            placeholder="Ex&nbsp;: 1200"
            helper={
              nombre > 1
                ? `Consultable sur moncompteformation.gouv.fr. Sans solde, le CPF est indiqué sans montant. Même solde retenu pour chaque personne de ce profil${INSECABLE}: prenez le plus bas, ou créez un profil par solde.`
                : 'Consultable sur moncompteformation.gouv.fr. Sans solde, le CPF est indiqué sans montant.'
            }
          />
        )}
      </div>
    </div>
  );
}
