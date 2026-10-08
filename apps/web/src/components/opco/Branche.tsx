import type { AlerteOpco, OpcoData, VarianteBranche } from '@opco/core';
import { ElementAlerte } from '@/components/ui/AlertesOpco';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { Etiquette } from '@/components/ui/Etiquette';
import { Icon } from '@/components/ui/Icon';
import { SourceBadge } from '@/components/ui/SourceBadge';
import { alertesDeLaBranche, lignesDuBareme, resumeDesAlertes, resumeIdcc } from '@/lib/fiche';
import { de, texteFr } from '@/lib/format';
import { Bareme, BaremeDegressif } from './Bareme';
import { ListeIdcc } from './ListeIdcc';
import { ListeTailles } from './Tailles';
import { TexteDonnees } from './TexteDonnees';

type Sigles = Readonly<Record<string, string>> | undefined;

/**
 * Alertes de l'OPCO qui visent cette branche (un de ses codes IDCC), reprises dans sa carte : type, périmètre, extrait
 * cité mot pour mot, source et date de vérification, comme dans la liste générale des alertes.
 */
function AlertesDeBranche({ alertes, opcoName }: { alertes: AlerteOpco[]; opcoName: string }) {
  return (
    <div className="rounded-2xl border border-rouge/25 bg-rouge-soft p-4 break-words">
      <p className="font-display text-[0.9375rem] leading-snug font-bold text-rouge">
        {alertes.length > 1
          ? `${alertes.length} alertes publiées par ${opcoName} pour cette branche`
          : `Alerte publiée par ${opcoName} pour cette branche`}
      </p>
      <ul className="mt-3 space-y-3">
        {alertes.map((a, i) => (
          <ElementAlerte key={`${a.type}-${a.branche}-${i}`} alerte={a} />
        ))}
      </ul>
    </div>
  );
}

/**
 * Barème d'une branche professionnelle, replié (`<details>`, ancre = identifiant de la branche) : le résumé donne le nom,
 * les conventions collectives, la fiabilité et, s'il y en a, le type des alertes qui la visent ; le contenu, ces alertes,
 * la note, la source, les postes que la branche fixe elle-même (tableau ou cartes), son barème dégressif, son budget et
 * ses plafonds par taille.
 */
export function CarteBranche({
  opco,
  variante,
  sigles,
}: {
  opco: OpcoData;
  variante: VarianteBranche;
  sigles: Sigles;
}) {
  const lignes = lignesDuBareme(
    variante,
    variante.prise_en_charge_salaires_mode ?? opco.prise_en_charge_salaires_mode,
    variante.frais_restauration_unite ?? opco.frais_restauration_unite,
  );
  const alertes = alertesDeLaBranche(opco.alertes ?? [], variante.idcc);
  const seuils = variante.cout_horaire_seuils ?? [];
  const tailles = variante.plafonds_par_taille ?? [];
  return (
    <details id={variante.id} className="group/branche rounded-carte border border-filet bg-white shadow-douce">
      {/* Le résumé ne contient que du texte courant et un titre (modèle de contenu de <summary>) : la grille place la
          pastille à gauche du titre et de sa ligne d'informations. À l'impression, la pastille est masquée : une seule
          colonne, sinon le titre prenait la colonne `auto` et poussait les informations hors de la page. */}
      <summary className="grid cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-carte p-4 transition-[background-color] group-open/branche:rounded-b-none hover:bg-lin-soft focus-visible:outline-offset-[-3px] sm:gap-x-4 sm:p-5 print:grid-cols-1 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="row-span-2 mt-0.5 grid size-8 place-items-center rounded-full bg-turquoise-soft text-turquoise-deep print:hidden"
        >
          <Icon name="chevron" className="size-4 transition-transform duration-200 group-open/branche:rotate-90" strokeWidth={2} />
        </span>
        <h3 className="text-base leading-snug font-bold text-texte sm:text-lg">{texteFr(variante.branche_nom)}</h3>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-texte-discret">
          <span>{resumeIdcc(variante.idcc)}</span>
          <ConfidenceBadge confidence={variante.confidence} />
          {resumeDesAlertes(alertes).map((t) => (
            <Etiquette key={t.type} tone="rouge">
              {t.libelle}
            </Etiquette>
          ))}
        </span>
      </summary>

      <div className="space-y-5 border-t border-filet px-4 pt-5 pb-5 sm:px-5">
        {alertes.length > 0 && <AlertesDeBranche alertes={alertes} opcoName={opco.name} />}
        {variante.note && (
          <p className="text-sm leading-relaxed text-texte-doux [overflow-wrap:anywhere]">
            <TexteDonnees texte={variante.note} sigles={sigles} />
          </p>
        )}
        <div className="flex flex-wrap items-start gap-x-5 gap-y-2 text-sm text-texte-discret">
          <SourceBadge url={variante.source_url} label="Source de la branche" />
          {/* Jusqu'à trois codes, le résumé les cite déjà ; au-delà, il n'en donne que le nombre. */}
          {variante.idcc.length > 3 && (
            <div className="min-w-0">
              <ListeIdcc codes={variante.idcc} />
            </div>
          )}
        </div>
        <div className="space-y-3">
          <p className="text-sm text-texte-discret">
            Postes que cette branche fixe elle-même&nbsp;; les autres postes suivent le barème général {de(opco.name)}.
          </p>
          {lignes.length > 0 && (
            <Bareme lignes={lignes} legende={`Barème de la branche ${variante.branche_nom}, poste par poste`} sigles={sigles} />
          )}
        </div>
        {seuils.length > 0 && (
          <BaremeDegressif
            seuils={seuils}
            mode={variante.cout_horaire_seuils_mode ?? opco.cout_horaire_seuils_mode}
            certifiant={variante.cout_horaire_seuils_certifiant ?? opco.cout_horaire_seuils_certifiant}
          />
        )}
        {variante.budget_annuel_description && (
          <p className="text-sm leading-relaxed text-texte-doux [overflow-wrap:anywhere]">
            <span className="font-semibold text-texte">Budget annuel&nbsp;:</span>{' '}
            <TexteDonnees texte={variante.budget_annuel_description} sigles={sigles} />
          </p>
        )}
        {tailles.length > 0 && (
          <div>
            <h4 className="mb-3 text-[0.9375rem] leading-snug font-bold text-texte">Selon la taille de l&apos;entreprise</h4>
            <ListeTailles plafonds={tailles} sigles={sigles} titres={false} />
          </div>
        )}
      </div>
    </details>
  );
}
