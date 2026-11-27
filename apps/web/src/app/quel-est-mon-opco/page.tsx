import type { Metadata } from 'next';
import Link from 'next/link';
import { EMBEDDED_OPCOS, URL_VERIFICATION_OPCO } from '@opco/core';
import { DonneesStructurees } from '@/components/site/DonneesStructurees';
import { Callout, GuideBody, GuideCta, GuideHero, GuideSection, Source } from '@/components/site/Guide';
import { QuestionsFrequentes } from '@/components/site/QuestionsFrequentes';
import { Etiquette } from '@/components/ui/Etiquette';
import { conventionsParOpco, lignesDesConventions } from '@/lib/conventions';
import { grapheDePage } from '@/lib/donnees-structurees';
import type { QuestionReponse } from '@/lib/donnees-structurees';
import { trierParNom } from '@/lib/fiche';
import { PAGES, REVUE_DES_GUIDES, metadonnees } from '@/lib/metadonnees';
import { RechercheIdcc } from './_RechercheIdcc';

export const metadata: Metadata = metadonnees(PAGES.quelOpco);

/* Tableaux : mêmes classes que le guide « Comprendre les OPCO » (une carte par ligne sous 640 px). */
const EN_TETE = 'px-4 py-3 text-left text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase sm:px-5';
const LIGNE = 'align-top max-sm:block max-sm:px-4 max-sm:py-4';
const TITRE_LIGNE = 'px-4 py-3.5 text-left leading-snug font-semibold text-texte sm:px-5 max-sm:block max-sm:p-0';
const CELLULE =
  'px-4 py-3.5 leading-relaxed text-texte-doux sm:px-5 max-sm:mt-2 max-sm:block max-sm:p-0 max-sm:before:block max-sm:before:text-xs max-sm:before:font-semibold max-sm:before:tracking-[0.12em] max-sm:before:text-texte-discret max-sm:before:uppercase max-sm:before:content-[attr(data-label)]';

/*
 * Grand tableau des conventions (près de 1 000 lignes) : le style est posé une fois sur le tableau, par sélecteurs de
 * descendants, et non sur chaque cellule. Avec les classes du tableau des 11 OPCO répétées sur chaque ligne, la page
 * pesait 2,9 Mo (mesuré le 27/11/2026). Sous 640 px, chaque ligne devient un bloc : code, intitulé, puis OPCO.
 */
const TABLEAU_CONVENTIONS = [
  'w-full text-sm max-sm:block [&_a]:font-medium [&_a]:text-orange-deep [&_a]:underline [&_a]:underline-offset-4',
  '[&_thead]:bg-lin-soft max-sm:[&_thead]:sr-only',
  '[&_thead_th]:px-4 [&_thead_th]:py-3 [&_thead_th]:text-left [&_thead_th]:text-xs [&_thead_th]:font-semibold [&_thead_th]:tracking-[0.12em] [&_thead_th]:text-texte-discret [&_thead_th]:uppercase sm:[&_thead_th]:px-5',
  '[&_tbody]:divide-y [&_tbody]:divide-filet max-sm:[&_tbody]:block',
  '[&_tbody_tr]:align-top max-sm:[&_tbody_tr]:block max-sm:[&_tbody_tr]:px-4 max-sm:[&_tbody_tr]:py-3',
  '[&_tbody_th]:px-4 [&_tbody_th]:py-3 [&_tbody_th]:text-left [&_tbody_th]:font-semibold [&_tbody_th]:whitespace-nowrap [&_tbody_th]:text-texte sm:[&_tbody_th]:px-5 max-sm:[&_tbody_th]:block max-sm:[&_tbody_th]:p-0',
  '[&_tbody_td]:px-4 [&_tbody_td]:py-3 [&_tbody_td]:leading-relaxed [&_tbody_td]:text-texte-doux sm:[&_tbody_td]:px-5 max-sm:[&_tbody_td]:block max-sm:[&_tbody_td]:p-0 max-sm:[&_tbody_td]:mt-1',
].join(' ');

const LIGNES = lignesDesConventions();
const PAR_OPCO = conventionsParOpco(LIGNES);
const OPCOS = trierParNom(EMBEDDED_OPCOS);
const ID_TABLEAU = 'tableau-conventions';

const FIL = { page: 'Quel est mon OPCO ?', intermediaires: [{ nom: 'Employeurs', chemin: '/employeurs/' }] };

const TOC = [
  { id: 'regle', label: 'La règle : la convention collective' },
  { id: 'idcc', label: "Où trouver l'IDCC" },
  { id: 'methodes', label: 'Trois façons de trouver votre OPCO' },
  { id: 'cas', label: 'Cas particuliers' },
  { id: 'onze', label: 'Les 11 OPCO et leurs secteurs' },
  { id: 'conventions', label: 'Toutes les conventions collectives' },
  { id: 'questions', label: 'Questions fréquentes' },
];

const QUESTIONS: QuestionReponse[] = [
  {
    question: 'Comment savoir quel est mon OPCO ?',
    reponse:
      "Votre OPCO dépend de la convention collective appliquée par l'entreprise, identifiée par son code IDCC, ou à défaut de son activité principale. Cherchez l'IDCC dans le tableau de cette page, lancez le simulateur avec le nom ou le SIREN de l'entreprise, ou utilisez l'outil officiel de France compétences, qui accepte le SIRET.",
  },
  {
    question: "Où trouver le code IDCC de mon entreprise ?",
    reponse:
      "Le bulletin de paie doit mentionner la convention collective applicable au salarié ; le code IDCC y figure souvent, mais il ne fait pas partie des mentions obligatoires. À défaut, l'outil de France compétences retrouve l'OPCO à partir du SIRET, et notre simulateur lit les conventions déclarées par l'entreprise à partir de son nom ou de son SIREN.",
  },
  {
    question: "Quel OPCO quand l'entreprise n'a pas de convention collective ?",
    reponse:
      "Sans convention collective, le rattachement se fait selon l'activité principale réellement exercée. L'outil de France compétences prévoit une recherche avancée pour ce cas : vous indiquez le département et l'activité, il vous oriente vers l'OPCO à déclarer. En cas de doute, demandez confirmation à l'OPCO pressenti ou à votre expert-comptable.",
  },
  {
    question: "Peut-on choisir ou changer d'OPCO ?",
    reponse:
      "On ne choisit pas son OPCO : il découle de la convention collective appliquée, ou à défaut de l'activité principale. Si l'entreprise change de convention collective, son OPCO peut donc changer aussi. Nous n'avons trouvé aucun texte officiel décrivant une procédure : rapprochez-vous de votre expert-comptable et des deux OPCO concernés.",
  },
  {
    question: 'Qui collecte la contribution formation des entreprises ?',
    reponse:
      "Depuis le 1er janvier 2022, l'Urssaf, ou la MSA pour le secteur agricole, collecte les contributions formation et apprentissage des entreprises via la DSN, puis France compétences répartit les fonds. L'entreprise doit donc indiquer le bon OPCO dans ses déclarations : c'est pour cela que France compétences a ouvert l'outil quel-est-mon-opco.",
  },
  {
    question: 'Travailleur indépendant : quel organisme finance ma formation ?',
    reponse:
      "Sans salarié, vous relevez d'un fonds d'assurance formation, pas d'un OPCO : AGEFICE pour le commerce, l'industrie et les services, FAFCEA pour l'artisanat, FIF PL pour les professions libérales, FAF PM pour les médecins libéraux, VIVEA pour les exploitants agricoles. Vous y cotisez par la contribution à la formation professionnelle, payée en novembre.",
  },
  {
    question: 'Une entreprise peut-elle relever de plusieurs OPCO ?',
    reponse:
      "En règle générale, non : une entreprise relève d'un seul OPCO, celui de sa convention collective. Une entreprise dont les établissements appliquent des conventions différentes peut en voir apparaître plusieurs ; quelques conventions sont aussi partagées entre deux OPCO selon l'activité exercée. Le tableau de cette page signale ces cas.",
  },
];

const GRAPHE = grapheDePage({
  chemin: PAGES.quelOpco.chemin,
  titre: PAGES.quelOpco.titre,
  description: PAGES.quelOpco.description,
  type: 'Article',
  nomCourt: FIL.page,
  intermediaires: FIL.intermediaires,
  modifieLe: REVUE_DES_GUIDES,
  publieLe: REVUE_DES_GUIDES,
  questions: QUESTIONS,
});

/** Cellule « OPCO » d'une convention : lien vers la fiche, cas partagé, ou aucun OPCO identifié. */
function CelluleOpco({ ligne }: { ligne: (typeof LIGNES)[number] }) {
  if (ligne.opcos.length === 0) return <span>Aucun OPCO identifié</span>;
  const liens = ligne.opcos.map((o, i) => (
    <span key={o.slug}>
      {i > 0 && ' ou '}
      <Link href={`/opco/${o.slug}/`}>{o.nom}</Link>
    </span>
  ));
  return (
    <>
      {liens}
      {ligne.opcos.length > 1 && <span> selon l&apos;activité</span>}
      {ligne.certitude === 'a_confirmer' && ligne.opcos.length === 1 && (
        <Etiquette tone="or" className="ml-2 align-middle">
          À confirmer
        </Etiquette>
      )}
    </>
  );
}

export default function QuelEstMonOpcoPage() {
  return (
    <main>
      <DonneesStructurees graphe={GRAPHE} />
      <GuideHero
        fil={FIL}
        revue={REVUE_DES_GUIDES}
        eyebrow="Guide · trouver son opérateur de compétences"
        title={
          <>
            Quel est{' '}
            <span className="mark-groupe">
              <span className="mark">mon OPCO</span>&nbsp;?
            </span>
          </>
        }
        lead="Votre OPCO ne se choisit pas : il découle de la convention collective de l'entreprise, identifiée par son code IDCC. Voici comment le trouver en une minute, et le tableau des conventions collectives avec leur OPCO."
      />

      <GuideBody toc={TOC}>
        <GuideSection id="regle" number="01" title="La règle : la convention collective décide">
          <p>
            Votre OPCO est celui de la <strong>convention collective appliquée par l&apos;entreprise</strong>, identifiée
            par son code <strong>IDCC</strong>. À défaut de convention collective, le rattachement se fait selon
            l&apos;activité principale réellement exercée. Le code NAF ne suffit pas : deux entreprises au même code
            NAF peuvent appliquer des conventions différentes, donc relever de deux OPCO.
          </p>
          <p>
            Depuis le 1er janvier 2022, l&apos;Urssaf (ou la MSA) collecte les contributions formation et
            apprentissage par la DSN : l&apos;entreprise y déclare son OPCO, qui reçoit ensuite les fonds répartis par
            France compétences. Se tromper d&apos;OPCO, c&apos;est frapper à la mauvaise porte au moment de faire
            financer une formation.
          </p>
          <p className="text-sm text-texte-discret">
            Source :{' '}
            <Source href="https://www.francecompetences.fr/fiche/nouveau-systeme-de-collecte-des-contributions-formation-apprentissage-france-competences-lance-un-moteur-de-recherche-pour-identifier-son-opco/">
              France compétences
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="idcc" number="02" title="Où trouver l'IDCC">
          <p>
            Le bulletin de paie doit mentionner la convention collective de branche applicable au salarié. Le code
            IDCC à quatre chiffres y figure souvent, à côté de l&apos;intitulé, mais il ne fait pas partie des mentions
            obligatoires : si vous ne le voyez pas, cherchez l&apos;intitulé de la convention dans le tableau plus bas,
            ou demandez-le au service paie ou à l&apos;expert-comptable.
          </p>
          <p className="text-sm text-texte-discret">
            Source :{' '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F559">
              service-public.gouv.fr (mentions du bulletin de paie)
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="methodes" number="03" title="Trois façons de trouver votre OPCO">
          <ul className="list-disc space-y-3 pl-5">
            <li>
              <strong>Avec l&apos;IDCC</strong>{' '}: cherchez le code ou l&apos;intitulé dans le{' '}
              <a href="#conventions" className="lien">
                tableau des conventions collectives
              </a>{' '}
              de cette page, qui donne l&apos;OPCO et renvoie vers sa fiche (barèmes 2026, frais annexes,
              dispositifs).
            </li>
            <li>
              <strong>Avec le nom ou le SIREN de l&apos;entreprise</strong>{' '}: le{' '}
              <Link href="/simulateur/" className="lien">
                simulateur
              </Link>{' '}
              interroge l&apos;API Recherche d&apos;entreprises de l&apos;État, lit les conventions collectives
              déclarées par l&apos;entreprise et en déduit son OPCO, puis chiffre la prise en charge de votre projet.
            </li>
            <li>
              <strong>Avec le SIRET</strong>{' '}: l&apos;outil officiel de France compétences,{' '}
              <Source href={URL_VERIFICATION_OPCO} titre={URL_VERIFICATION_OPCO}>
                quel-est-mon-opco.francecompetences.fr
              </Source>
              , retrouve l&apos;OPCO à partir du SIRET ou de l&apos;IDCC ; sans IDCC, sa recherche avancée demande le
              département et l&apos;activité principale.
            </li>
          </ul>
          <p>
            France compétences publie aussi sur data.gouv.fr la <strong>Table SIRET-OPCO</strong>, établie à partir des
            DSN, qui associe chaque établissement à son OPCO et à l&apos;IDCC applicable (jeu de données mis à jour le
            9 novembre 2026). Elle sert aux traitements en nombre ; pour une seule entreprise, l&apos;outil en ligne
            est plus simple.
          </p>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.francecompetences.fr/fiche/nouveau-systeme-de-collecte-des-contributions-formation-apprentissage-france-competences-lance-un-moteur-de-recherche-pour-identifier-son-opco/">
              France compétences
            </Source>
            {' · '}
            <Source href="https://www.data.gouv.fr/datasets/table-siret-opco">data.gouv.fr (Table SIRET-OPCO)</Source>
          </p>
        </GuideSection>

        <GuideSection id="cas" number="04" title="Cas particuliers">
          <ul className="list-disc space-y-3 pl-5">
            <li>
              <strong>Pas de convention collective</strong>{' '}: le rattachement suit l&apos;activité principale. La
              recherche avancée de l&apos;outil de France compétences est faite pour ce cas.
            </li>
            <li>
              <strong>Convention partagée</strong>{' '}: quelques conventions relèvent de deux OPCO selon
              l&apos;activité exercée (par exemple les exploitations forestières, entre AKTO et OCAPIAT). Le tableau
              les signale par « selon l&apos;activité ».
            </li>
            <li>
              <strong>Convention fusionnée ou close</strong>{' '}: une convention absorbée par une autre suit l&apos;OPCO
              de la convention qui la remplace ; le tableau indique laquelle. Un rattachement qui ne repose sur aucune
              source officielle propre à ce code porte la mention « À confirmer ».
            </li>
            <li>
              <strong>Plusieurs établissements, plusieurs conventions</strong>{' '}: plusieurs OPCO peuvent apparaître.
              Le simulateur les présente et vous choisissez ; l&apos;outil de France compétences accepte le SIRET de
              chaque établissement.
            </li>
            <li>
              <strong>Travailleur indépendant sans salarié</strong>{' '}: pas d&apos;OPCO, mais un fonds
              d&apos;assurance formation (AGEFICE, FAFCEA, FIF PL, FAF PM, VIVEA), financé par la contribution à la
              formation professionnelle versée en novembre.{' '}
              <Source href="https://entreprendre.service-public.gouv.fr/vosdroits/F23459">service-public.gouv.fr</Source>
            </li>
          </ul>
          <Callout tone="info" title="Changer d'OPCO">
            On ne choisit pas son OPCO. Un changement de convention collective peut entraîner un changement d&apos;OPCO,
            mais aucune procédure officielle n&apos;est publiée : faites le point avec votre expert-comptable et les deux
            OPCO concernés.
          </Callout>
        </GuideSection>

        <GuideSection id="onze" number="05" title="Les 11 OPCO et leurs secteurs">
          <div className="overflow-clip rounded-carte border border-filet bg-white shadow-douce">
            <table className="w-full text-sm max-sm:block">
              <thead className="bg-lin-soft max-sm:sr-only">
                <tr>
                  <th scope="col" className={EN_TETE}>OPCO</th>
                  <th scope="col" className={EN_TETE}>Secteurs couverts</th>
                  <th scope="col" className={EN_TETE}>Conventions du tableau</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-filet max-sm:block">
                {OPCOS.map((o) => (
                  <tr key={o.slug} className={LIGNE}>
                    <th scope="row" className={TITRE_LIGNE}>
                      <Link href={`/opco/${o.slug}/`} className="lien">
                        {o.name}
                      </Link>
                    </th>
                    <td data-label="Secteurs couverts" className={CELLULE}>
                      {o.secteurs}
                    </td>
                    <td data-label="Conventions du tableau" className={CELLULE}>
                      <span className="amount">{PAR_OPCO.get(o.slug) ?? 0}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GuideSection>

        <GuideSection id="conventions" number="06" title="Toutes les conventions collectives et leur OPCO">
          <p>
            {LIGNES.length}
            {' '}codes IDCC, classés par numéro. Le rattachement vient de nos données, établies à partir des
            arrêtés d&apos;agrément des OPCO, des listes de conventions qu&apos;ils publient et de la table des IDCC de
            la DSN ; c&apos;est le même calcul que celui du simulateur. Pour une décision engageante, confirmez avec
            l&apos;outil officiel de France compétences.
          </p>
          <RechercheIdcc idTableau={ID_TABLEAU} total={LIGNES.length} />
          <div className="overflow-clip rounded-carte border border-filet bg-white shadow-douce">
            <table id={ID_TABLEAU} className={TABLEAU_CONVENTIONS}>
              <caption className="sr-only">Conventions collectives (code IDCC) et OPCO de rattachement</caption>
              <thead>
                <tr>
                  <th scope="col">IDCC</th>
                  <th scope="col">Convention collective</th>
                  <th scope="col">OPCO</th>
                </tr>
              </thead>
              <tbody>
                {LIGNES.map((l) => (
                  <tr key={l.idcc} id={`idcc-${l.idcc}`}>
                    <th scope="row">{l.idcc}</th>
                    <td>
                      {l.titre}
                      {l.remplaceePar && (
                        <span className="block text-xs text-texte-discret">
                          Fusionnée dans l&apos;IDCC <a href={`#idcc-${l.remplaceePar}`}>{l.remplaceePar}</a>
                        </span>
                      )}
                    </td>
                    <td>
                      <CelluleOpco ligne={l} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GuideSection>

        <QuestionsFrequentes questions={QUESTIONS} />
      </GuideBody>

      <GuideCta
        title="Votre OPCO trouvé, chiffrez votre projet"
        text="Le simulateur applique les barèmes 2026 de votre OPCO à votre formation et ajoute les autres financements possibles."
        href="/simulateur/"
        label="Estimer mon financement"
      />
    </main>
  );
}
