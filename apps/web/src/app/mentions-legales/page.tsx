import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GuideBody, GuideHero, GuideSection, Source } from '@/components/site/Guide';
import { Callout } from '@/components/ui/Callout';
import {
  LIBELLES_DES_CHAMPS,
  MENTIONS,
  RUBRIQUES_MENTIONS,
  TABLE_SIRET_OPCO,
  aCompleter,
  mentionsIncompletes,
} from '@/lib/mentions';
import type { Champ } from '@/lib/mentions';
import { PAGES, metadonnees } from '@/lib/metadonnees';

export const metadata: Metadata = metadonnees(PAGES.mentions);

/**
 * Une information légale : sa valeur, ou « [à compléter : libellé] » tant que l'éditeur ne l'a pas fournie, sur un fond
 * or doux qui la signale à la relecture (texte #1A1A1A, 15,92:1).
 */
function Valeur({ champ, libelle }: { champ: Champ; libelle: string }) {
  if (champ != null) return <>{champ}</>;
  return <span className="rounded bg-or-soft px-1 text-texte [box-decoration-break:clone]">{aCompleter(libelle)}</span>;
}

/** Informations d'une rubrique : libellé, puis valeur (à côté du libellé à partir de 640 px). */
function Informations({ lignes }: { lignes: [string, ReactNode][] }) {
  return (
    <dl className="max-w-[40rem] divide-y divide-filet rounded-carte border border-filet bg-white text-sm shadow-douce">
      {lignes.map(([libelle, valeur]) => (
        <div key={libelle} className="grid gap-1 px-4 py-3 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-4 sm:px-5">
          <dt className="font-semibold text-texte">{libelle}</dt>
          <dd className="min-w-0 text-texte-doux [overflow-wrap:anywhere]">{valeur}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Mentions légales (LCEN, article 6) et information sur les données (RGPD, article 13). Les informations viennent de
 * lib/mentions.ts : tant que l'une manque, elle s'écrit entre crochets et un encadré le signale en tête de page.
 */
export default function MentionsLegalesPage() {
  const { editeur, directeurPublication, hebergeur, donnees } = MENTIONS;
  const libelles = LIBELLES_DES_CHAMPS;
  const contenu: Record<(typeof RUBRIQUES_MENTIONS)[number]['id'], ReactNode> = {
    editeur: (
      <>
        <p>
          Le site financementOPCO est un service de{' '}
          <Valeur champ={editeur.denomination} libelle={libelles.editeur.denomination} />, qui en est l&apos;éditeur.
        </p>
        <Informations
          lignes={[
            ['Dénomination', <Valeur key="d" champ={editeur.denomination} libelle={libelles.editeur.denomination} />],
            ['Forme juridique', <Valeur key="f" champ={editeur.formeJuridique} libelle={libelles.editeur.formeJuridique} />],
            ['Capital social', <Valeur key="c" champ={editeur.capitalSocial} libelle={libelles.editeur.capitalSocial} />],
            ['Siège social', <Valeur key="a" champ={editeur.adresseSiege} libelle={libelles.editeur.adresseSiege} />],
            ['SIREN', <Valeur key="s" champ={editeur.siren} libelle={libelles.editeur.siren} />],
            ['SIRET du siège', <Valeur key="t" champ={editeur.siretSiege} libelle={libelles.editeur.siretSiege} />],
            [
              'Immatriculation',
              <span key="r">
                RCS <Valeur champ={editeur.villeRcs} libelle={libelles.editeur.villeRcs} />
              </span>,
            ],
            [
              'TVA intracommunautaire',
              <Valeur key="v" champ={editeur.tvaIntracommunautaire} libelle={libelles.editeur.tvaIntracommunautaire} />,
            ],
            [
              'Adresse électronique',
              editeur.courriel ? (
                <a key="e" href={`mailto:${editeur.courriel}`} className="lien">
                  {editeur.courriel}
                </a>
              ) : (
                <Valeur key="e" champ={null} libelle={libelles.editeur.courriel} />
              ),
            ],
            ['Téléphone', <Valeur key="p" champ={editeur.telephone} libelle={libelles.editeur.telephone} />],
          ]}
        />
      </>
    ),
    // Fonction vide : aucune personne n'est nommée, `nom` complète la phrase (« le représentant légal de ... »).
    publication:
      directeurPublication.fonction === '' ? (
        <p>
          Le directeur de la publication est{' '}
          <Valeur champ={directeurPublication.nom} libelle={libelles.directeurPublication.nom} />.
        </p>
      ) : (
        <Informations
          lignes={[
            ['Nom', <Valeur key="n" champ={directeurPublication.nom} libelle={libelles.directeurPublication.nom} />],
            [
              'Fonction',
              <Valeur key="f" champ={directeurPublication.fonction} libelle={libelles.directeurPublication.fonction} />,
            ],
          ]}
        />
      ),
    hebergement: (
      <>
        <p>Le site est fait de pages statiques, déposées chez l&apos;hébergeur et servies telles quelles.</p>
        <Informations
          lignes={[
            ['Hébergeur', <Valeur key="h" champ={hebergeur.denomination} libelle={libelles.hebergeur.denomination} />],
            ['Adresse', <Valeur key="a" champ={hebergeur.adresse} libelle={libelles.hebergeur.adresse} />],
            ['Téléphone', <Valeur key="t" champ={hebergeur.telephone} libelle={libelles.hebergeur.telephone} />],
          ]}
        />
      </>
    ),
    donnees: (
      <>
        <p>
          Le site ne dépose aucun cookie, n&apos;utilise aucun outil de mesure d&apos;audience et ne charge aucun script
          d&apos;un autre site. Le simulateur calcule dans votre navigateur&nbsp;: aucune réponse n&apos;est conservée,
          et toutes disparaissent quand vous fermez ou rechargez la page. Seul le texte de la recherche
          d&apos;entreprise quitte votre navigateur.
        </p>
        <p>
          <strong>Recherche d&apos;entreprise.</strong>{' '}À l&apos;étape Entreprise du simulateur, votre navigateur
          interroge directement l&apos;API Recherche d&apos;entreprises de l&apos;État, opérée par la direction
          interministérielle du numérique (DINUM)&nbsp;: elle reçoit le texte recherché et l&apos;adresse IP de votre
          connexion. Le site n&apos;en garde rien.
        </p>
        <p>
          <strong>Formulaire de contact.</strong>{' '}Le site n&apos;envoie rien&nbsp;: le formulaire ouvre votre messagerie
          avec un message adressé à SFG Développement, que vous envoyez vous-même. SFG Développement traite les
          informations de ce message (nom, adresse électronique, entreprise, téléphone, message) pour vous répondre.
        </p>
        <Informations
          lignes={[
            ['Finalité', 'Répondre à votre message'],
            ['Base légale', <Valeur key="b" champ={donnees.baseLegaleContact} libelle={libelles.donnees.baseLegaleContact} />],
            [
              'Durée de conservation',
              <Valeur key="c" champ={donnees.dureeConservationContact} libelle={libelles.donnees.dureeConservationContact} />,
            ],
            [
              'Exercice de vos droits',
              <Valeur key="x" champ={donnees.adresseExerciceDroits} libelle={libelles.donnees.adresseExerciceDroits} />,
            ],
            [
              'Délégué à la protection des données',
              <Valeur
                key="p"
                champ={donnees.delegueProtectionDonnees}
                libelle={libelles.donnees.delegueProtectionDonnees}
              />,
            ],
          ]}
        />
        <p>
          Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, d&apos;opposition, de
          limitation et de portabilité sur les données qui vous concernent, à exercer à l&apos;adresse ci-dessus. Si vous
          estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (
          <Source href="https://www.cnil.fr">www.cnil.fr</Source>).
        </p>
      </>
    ),
    sources: (
      <ul className="list-disc space-y-3 pl-5">
        <li>
          Les informations sur les entreprises viennent de l&apos;API Recherche d&apos;entreprises (DINUM), qui diffuse
          la base SIRENE de l&apos;INSEE, sous{' '}
          <Source href="https://www.etalab.gouv.fr/licence-ouverte-open-licence/">licence ouverte 2.0</Source>.
        </li>
        <li>
          Les pourcentages d&apos;établissements par secteur proposés quand une entreprise n&apos;a pas de convention
          collective connue viennent de la Table SIRET-OPCO publiée par France compétences sur{' '}
          <Source href={TABLE_SIRET_OPCO.adresse}>data.gouv.fr</Source> (licence ouverte 2.0, mise à jour du{' '}
          {TABLE_SIRET_OPCO.miseAJour}), jointe à l&apos;API Recherche d&apos;entreprises sur un échantillon
          d&apos;établissements.
        </li>
        <li>
          Les barèmes des OPCO et les aides reprennent des sources publiques&nbsp;: chaque montant cite sa source
          officielle et sa date de vérification.
        </li>
        <li>Les polices Montserrat et Inter sont distribuées sous licence SIL Open Font License 1.1.</li>
        <li>Le logo et la marque SFG Développement sont la propriété de SFG Développement.</li>
      </ul>
    ),
    limites: (
      <p>
        Les montants affichés sont des estimations établies à partir de critères publics. Seul le financeur décide de la
        prise en charge, après étude du dossier. Le site ne fournit ni conseil juridique ni engagement de financement.
      </p>
    ),
  };

  return (
    <main>
      <GuideHero
        eyebrow="SFG Développement · financementOPCO"
        title="Mentions légales et données"
        lead="Qui édite et héberge le site, ce qu'il fait de vos données et d'où viennent ses informations."
      />
      <GuideBody toc={RUBRIQUES_MENTIONS.map((r) => ({ id: r.id, label: r.titre }))} etiquette="Sommaire de la page">
        {mentionsIncompletes().length > 0 && (
          <Callout tone="avertissement" titre="Page à compléter avant publication" className="max-w-[40rem]">
            Les champs entre crochets attendent les informations légales de l&apos;éditeur.
          </Callout>
        )}
        {RUBRIQUES_MENTIONS.map((r, i) => (
          <GuideSection key={r.id} id={r.id} number={String(i + 1).padStart(2, '0')} title={r.titre}>
            {contenu[r.id]}
          </GuideSection>
        ))}
      </GuideBody>
    </main>
  );
}
