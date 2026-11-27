import type { Metadata } from 'next';
import Link from 'next/link';
import { EMBEDDED_AIDES, EMBEDDED_OPCOS } from '@opco/core';
import { DonneesStructurees } from '@/components/site/DonneesStructurees';
import { Callout, GuideBody, GuideHero, GuideSection, Source } from '@/components/site/Guide';
import { lignesDesConventions } from '@/lib/conventions';
import { ID_EDITEUR, grapheDePage } from '@/lib/donnees-structurees';
import { trierParNom } from '@/lib/fiche';
import { dateFr } from '@/lib/format';
import { MENTIONS } from '@/lib/mentions';
import { PAGES, REVUE_DES_GUIDES, metadonnees } from '@/lib/metadonnees';

export const metadata: Metadata = metadonnees(PAGES.aPropos);

/* Chiffres lus dans les données au build : la page dit toujours ce que contient le site publié. */
const AIDES_ACTIVES = EMBEDDED_AIDES.filter((a) => a.statut !== 'suspendu').length;
const CONVENTIONS = lignesDesConventions().length;
const OPCOS = trierParNom(EMBEDDED_OPCOS);

const FIL = { page: 'Méthode et sources' };

const TOC = [
  { id: 'editeur', label: 'Qui publie le site' },
  { id: 'sources', label: "D'où viennent les informations" },
  { id: 'verification', label: 'Comment chaque montant est vérifié' },
  { id: 'fraicheur', label: 'Dates de vérification' },
  { id: 'limites', label: 'Ce que le site ne fait pas' },
  { id: 'erreur', label: 'Signaler une erreur' },
];

const GRAPHE = grapheDePage({
  chemin: PAGES.aPropos.chemin,
  titre: PAGES.aPropos.titre,
  description: PAGES.aPropos.description,
  type: 'AboutPage',
  nomCourt: FIL.page,
  modifieLe: REVUE_DES_GUIDES,
  sujet: { '@id': ID_EDITEUR },
});

export default function AProposPage() {
  const { editeur } = MENTIONS;
  return (
    <main>
      <DonneesStructurees graphe={GRAPHE} />
      <GuideHero
        fil={FIL}
        revue={REVUE_DES_GUIDES}
        eyebrow="financementOPCO · SFG Développement"
        title={
          <>
            Méthode et sources&nbsp;: comment nous{' '}
            <span className="mark-groupe">
              <span className="mark">vérifions</span>
            </span>{' '}
            les montants
          </>
        }
        lead="Un montant de prise en charge n'a de valeur que si l'on sait d'où il vient et de quand il date. Voici qui publie ce site, où nous lisons les règles, et comment chaque chiffre est contrôlé."
      />

      <GuideBody toc={TOC} etiquette="Sommaire de la page">
        <GuideSection id="editeur" number="01" title="Qui publie le site">
          <p>
            financementOPCO est édité par <strong>{editeur.denomination}</strong>, société par actions simplifiée
            installée à Bezons (Val-d&apos;Oise), SIREN {editeur.siren}. L&apos;équipe accompagne les entreprises dans
            leurs projets de formation : montage des dossiers de financement et formations en bureautique, langues,
            intelligence artificielle, santé et sécurité au travail.
          </p>
          <p>
            Le site n&apos;est pas un site officiel. Il n&apos;est rattaché à aucun OPCO, ni à France compétences, ni à
            la Caisse des dépôts : il rassemble et explique les règles que ces organismes publient, avec un lien vers
            chacune.
          </p>
          <p className="text-sm text-texte-discret">
            Identité complète de l&apos;éditeur et de l&apos;hébergeur :{' '}
            <Link href="/mentions-legales/" className="lien">
              mentions légales
            </Link>
          </p>
        </GuideSection>

        <GuideSection id="sources" number="02" title="D'où viennent les informations">
          <p>Nous ne retenons que des sources officielles, ouvertes à tous :</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              les textes : Code du travail et Journal officiel sur{' '}
              <Source href="https://www.legifrance.gouv.fr/">Légifrance</Source>, fiches de{' '}
              <Source href="https://www.service-public.gouv.fr/">service-public.gouv.fr</Source>, documents budgétaires
              de l&apos;Assemblée nationale et du Sénat ;
            </li>
            <li>
              les financeurs : sites des 11 OPCO (critères de prise en charge, barèmes par branche, alertes), France
              Travail, Mon Compte Formation, Transitions Pro, l&apos;Agefiph, les Régions, les fonds d&apos;assurance
              formation des non-salariés, le FSE+ ;
            </li>
            <li>
              les données publiques : la Table SIRET-OPCO de France compétences sur{' '}
              <Source href="https://www.data.gouv.fr/datasets/table-siret-opco">data.gouv.fr</Source>
              {' '}et l&apos;API Recherche d&apos;entreprises de l&apos;État pour retrouver la convention collective
              d&apos;une entreprise.
            </li>
          </ul>
          <p>
            La presse spécialisée et les blogs nous servent de pistes, jamais de preuves : une information n&apos;entre
            dans le site qu&apos;une fois lue sur la page du financeur ou dans le texte officiel.
          </p>
        </GuideSection>

        <GuideSection id="verification" number="03" title="Comment chaque montant est vérifié">
          <p>
            Le site contient aujourd&apos;hui les barèmes des <strong>{EMBEDDED_OPCOS.length}&nbsp;OPCO</strong>,{' '}
            <strong>{AIDES_ACTIVES}&nbsp;aides et financements</strong>{' '}actifs et la correspondance de{' '}
            <strong>{CONVENTIONS}&nbsp;conventions collectives</strong>{' '}avec leur OPCO. Pour chaque montant, plafond
            ou date, nos données gardent trois choses : l&apos;adresse de la page officielle, l&apos;extrait de cette
            page recopié mot pour mot et la date à laquelle nous l&apos;avons lu.
          </p>
          <p>Chaque aide porte une étiquette de fiabilité dans le simulateur :</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Exact</strong>{' '}: le montant figure tel quel sur le site officiel du financeur ;
            </li>
            <li>
              <strong>Estimé</strong>{' '}: le montant est reconstitué à partir de documents officiels partiels ;
            </li>
            <li>
              <strong>Selon branche</strong>{' '}: le financeur ne publie pas de barème unique ; nous le disons plutôt que
              d&apos;inventer un chiffre.
            </li>
          </ul>
          <p>
            Une veille des sources officielles a lieu chaque mois. Un changement n&apos;est appliqué qu&apos;avec une
            source officielle et son extrait ; ce qui reste incertain est signalé comme tel ou laissé de côté.
          </p>
        </GuideSection>

        <GuideSection id="fraicheur" number="04" title="Dates de vérification">
          <p>
            Dernière revue complète des guides et des pages par profil : le{' '}
            <strong>{dateFr(REVUE_DES_GUIDES)}</strong>. Les barèmes de chaque OPCO portent leur propre date, affichée
            sur sa fiche :
          </p>
          <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {OPCOS.map((o) => (
              <li key={o.slug} className="flex justify-between gap-4 border-b border-filet/70 py-1.5">
                <Link href={`/opco/${o.slug}/`} className="lien">
                  {o.name}
                </Link>
                <span className="amount text-texte-discret">
                  {o.derniere_verification ? dateFr(o.derniere_verification) : 'date non indiquée'}
                </span>
              </li>
            ))}
          </ul>
          <Callout tone="info" title="Quand un site officiel est indisponible">
            Si la page d&apos;un financeur ne répond plus, nous gardons la dernière version vérifiée, avec sa date, et
            nous la revoyons dès que la page revient. Une date ancienne sur une fiche signale ce cas.
          </Callout>
        </GuideSection>

        <GuideSection id="limites" number="05" title="Ce que le site ne fait pas">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Il ne décide d&apos;aucune prise en charge : seul le financeur accorde un financement, après étude du
              dossier et dans la limite de ses fonds disponibles, que nous ne connaissons pas en temps réel.
            </li>
            <li>
              Il ne donne pas de conseil juridique : les montants sont des estimations établies à partir des critères
              publiés.
            </li>
            <li>
              Il ne conserve rien : le simulateur calcule dans votre navigateur, sans compte, sans cookie et sans
              outil de mesure d&apos;audience.
            </li>
          </ul>
        </GuideSection>

        <GuideSection id="erreur" number="06" title="Signaler une erreur">
          <p>
            Si un montant a changé, si un lien ne répond plus ou si une règle de votre branche manque, écrivez-nous
            depuis la page{' '}
            <Link href="/contact/" className="lien">
              Contact
            </Link>{' '}
            en choisissant le sujet « Signaler une erreur », avec l&apos;adresse de la page officielle si vous
            l&apos;avez. Nous vérifions et corrigeons, en datant la correction.
          </p>
        </GuideSection>
      </GuideBody>
    </main>
  );
}
