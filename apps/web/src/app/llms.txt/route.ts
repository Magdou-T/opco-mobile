import { EMBEDDED_OPCOS } from '@opco/core';
import { dateFr, verificationLaPlusRecente } from '@/lib/format';
import { ADRESSE_DU_SITE, NOM_DU_SITE, PAGES } from '@/lib/metadonnees';
import type { DescriptionDePage } from '@/lib/metadonnees';

export const dynamic = 'force-static';

/**
 * /llms.txt (format proposé sur llmstxt.org) : présentation du site en Markdown pour les assistants qui cherchent une
 * source sur le financement de la formation. Google ne s'en sert pas ; d'autres assistants le lisent. Tout est tiré des
 * métadonnées des pages et des données des OPCO : le fichier suit chaque build et ne dit rien que le site ne dise.
 */
function lien(page: DescriptionDePage): string {
  return `- [${page.titre}](${ADRESSE_DU_SITE}${page.chemin}): ${page.description}`;
}

export function GET() {
  const verification = verificationLaPlusRecente(EMBEDDED_OPCOS);
  const fiches = [...EMBEDDED_OPCOS]
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .map(
      (o) =>
        `- [${o.name}](${ADRESSE_DU_SITE}/opco/${o.slug}/): ${o.nom_complet}. Secteurs : ${o.secteurs}.${
          o.derniere_verification ? ` Barèmes vérifiés le ${dateFr(o.derniere_verification)}.` : ''
        }`,
    );

  const texte = [
    `# ${NOM_DU_SITE}`,
    '',
    `> Simulateur gratuit et guides des financements de la formation professionnelle en France : les 11 OPCO et leurs barèmes 2026, le CPF, les aides de l'État, de France Travail, des Régions, de Transitions Pro, de l'Agefiph et du FSE+. Chaque montant cite sa source officielle et sa date de vérification. Site édité par SFG Développement (organisme de formation, Bezons, SIREN 814 739 728).`,
    '',
    `Les montants sont indicatifs : seul le financeur (OPCO, Caisse des dépôts, France Travail, Région) décide d'une prise en charge, après étude du dossier. Barèmes des OPCO vérifiés pour la dernière fois le ${dateFr(verification)}.`,
    '',
    '## Par profil',
    '',
    lien(PAGES.employeurs),
    lien(PAGES.salaries),
    lien(PAGES.demandeursEmploi),
    lien(PAGES.cpf),
    '',
    '## Guides',
    '',
    lien(PAGES.quelOpco),
    lien(PAGES.comprendre),
    lien(PAGES.obligations),
    lien(PAGES.formerSansBudget),
    lien(PAGES.alternance),
    lien(PAGES.lexique),
    '',
    '## Outil',
    '',
    lien(PAGES.simulateur),
    '',
    '## Fiches des 11 OPCO',
    '',
    lien(PAGES.opco),
    ...fiches,
    '',
    '## Optional',
    '',
    lien(PAGES.aPropos),
    lien(PAGES.contact),
    lien(PAGES.mentions),
    '',
  ].join('\n');

  return new Response(texte, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
