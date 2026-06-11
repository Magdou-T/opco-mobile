// Injection des barèmes par branche (variantes_branche) — valeurs vérifiées
// sur les pages officielles le 11/06/2026 (citations exactes).
// Réexécutable : remplace le champ s'il existe déjà.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'core', 'data', 'opcos');

const SRC_OF = 'https://www.akto.fr/regles-de-prise-en-charge-organisme-de-formation/';
const SRC_CDG = 'https://www.akto.fr/regles-de-prise-en-charge-commerces-de-gros/';
const SRC_PHARMA = 'https://www.opcoep.fr/criteres-de-financement';

const VARIANTES = {
  akto: [
    {
      id: 'organismes-de-formation',
      branche_nom: 'Organismes de formation',
      idcc: ['1516'],
      source_url: SRC_OF,
      confidence: 'exact',
      note: "Baremes 2026 verifies le 11/06/2026 sur la page officielle de la branche.",
      cout_horaire_inter: {
        value: 60,
        confidence: 'exact',
        source_url: SRC_OF,
        note: '60 euros/h/stagiaire maximum (hors Espace Formation), entreprises <50 salaries. Intra : 1 200 euros/jour minimum 3 participants.',
      },
      prise_en_charge_salaires: {
        value: 15,
        confidence: 'exact',
        source_url: SRC_OF,
        note: 'Forfait remuneration 15 euros/h/stagiaire (plan conventionnel <50 salaries).',
      },
      prise_en_charge_salaires_mode: 'euro_par_heure',
      frais_hebergement: {
        value: 150,
        confidence: 'exact',
        source_url: SRC_OF,
        note: "Jusqu'a 150 euros/nuit.",
      },
      frais_restauration: {
        value: 25,
        confidence: 'exact',
        source_url: SRC_OF,
        note: "Jusqu'a 25 euros/repas (dejeuner et/ou diner).",
      },
      budget_annuel_max: {
        value: 4500,
        confidence: 'exact',
        source_url: SRC_OF,
        note: 'Budget annuel 2026 : 4 500 euros (<11 sal.), 5 600 euros (11-49 sal.) — verifie le 11/06/2026 (citation : « vous disposez d\'un budget annuel de 4 500 euros »).',
      },
      budget_annuel_description: 'Branche Organismes de formation 2026 : 4 500 euros/an (<11 sal.), 5 600 euros/an (11-49 sal.), couts pedagogiques hors Espace Formation.',
      plafonds_par_taille: [
        {
          taille: 'less_11',
          cout_horaire_max: 60,
          budget_annuel_max: 4500,
          quota_horaire_max: null,
          description: 'Organismes de formation <11 salaries : budget 4 500 euros/an, plafond pedagogique 60 euros/h, salaire 15 euros/h.',
        },
        {
          taille: '11_49',
          cout_horaire_max: 60,
          budget_annuel_max: 5600,
          quota_horaire_max: null,
          description: 'Organismes de formation 11-49 salaries : budget 5 600 euros/an, plafond pedagogique 60 euros/h, salaire 15 euros/h.',
        },
        {
          taille: '50_299',
          cout_horaire_max: null,
          budget_annuel_max: null,
          quota_horaire_max: null,
          description: '50+ salaries : plan conventionnel (80 % de la contribution conventionnelle versee, moins frais de gestion).',
        },
        {
          taille: '300_plus',
          cout_horaire_max: null,
          budget_annuel_max: null,
          quota_horaire_max: null,
          description: '300+ salaries : plan conventionnel selon contribution versee.',
        },
      ],
    },
    {
      id: 'commerces-de-gros',
      branche_nom: 'Commerces de gros',
      idcc: ['0573'],
      source_url: SRC_CDG,
      confidence: 'exact',
      note: 'Baremes 2026 de la page officielle de la branche Commerces de gros.',
      prise_en_charge_salaires: {
        value: 13,
        confidence: 'exact',
        source_url: SRC_CDG,
        note: 'Forfait 13 euros/h de formation/salarie forme pour toutes les actions realisees depuis le 1er janvier 2026.',
      },
      prise_en_charge_salaires_mode: 'euro_par_heure',
      budget_annuel_max: {
        value: 6000,
        confidence: 'exact',
        source_url: SRC_CDG,
        note: 'Budget annuel 2026 : 6 000 euros (<11 sal.), 12 000 euros (11-49 sal.). Couvre couts pedagogiques, remuneration et frais annexes.',
      },
      budget_annuel_description: 'Branche Commerces de gros 2026 : 6 000 euros/an (<11 sal.), 12 000 euros/an (11-49 sal.) — couts pedagogiques + remuneration + frais annexes.',
      plafonds_par_taille: [
        {
          taille: 'less_11',
          cout_horaire_max: null,
          budget_annuel_max: 6000,
          quota_horaire_max: null,
          description: 'Commerces de gros <11 salaries : budget annuel 6 000 euros (pedagogie + remuneration 13 euros/h + frais).',
        },
        {
          taille: '11_49',
          cout_horaire_max: null,
          budget_annuel_max: 12000,
          quota_horaire_max: null,
          description: 'Commerces de gros 11-49 salaries : budget annuel 12 000 euros (pedagogie + remuneration 13 euros/h + frais).',
        },
        {
          taille: '50_299',
          cout_horaire_max: null,
          budget_annuel_max: null,
          quota_horaire_max: null,
          description: '50+ salaries : pas de fonds mutualises PDC ; plan conventionnel selon contribution.',
        },
        {
          taille: '300_plus',
          cout_horaire_max: null,
          budget_annuel_max: null,
          quota_horaire_max: null,
          description: '300+ salaries : plan conventionnel selon contribution.',
        },
      ],
    },
  ],
  'opco-ep': [
    {
      id: 'pharmacie-officine',
      branche_nom: "Pharmacie d'officine",
      idcc: ['1996'],
      source_url: SRC_PHARMA,
      confidence: 'exact',
      note: 'Baremes 2026 de la page criteres de financement OPCO EP, branche Pharmacie d\'officine (verifies le 11/06/2026).',
      cout_horaire_inter: {
        value: 25,
        confidence: 'exact',
        source_url: SRC_PHARMA,
        note: '25 euros HT/h pour les formations transversales ; 40 euros HT/h pour les formations metier.',
      },
      cout_horaire_metier: {
        value: 40,
        confidence: 'exact',
        source_url: SRC_PHARMA,
        note: '40 euros HT/h pour les formations metier.',
      },
      prise_en_charge_salaires: {
        value: 12,
        confidence: 'exact',
        source_url: SRC_PHARMA,
        note: 'Frais de salaire : 12 euros HT/h, pour les entreprises de MOINS DE 11 SALARIES exclusivement.',
      },
      prise_en_charge_salaires_mode: 'euro_par_heure',
      frais_transport: {
        value: null,
        confidence: 'exact',
        source_url: SRC_PHARMA,
        note: 'Transport : 0,32 euros HT/km (entreprises <11 salaries).',
      },
      frais_hebergement: {
        value: 112,
        confidence: 'exact',
        source_url: SRC_PHARMA,
        note: 'Nuitee : 112 euros HT (metropoles/DROM), 96 euros HT (province). Entreprises <11 salaries.',
      },
      frais_restauration: {
        value: 19,
        confidence: 'exact',
        source_url: SRC_PHARMA,
        note: 'Repas : 19 euros HT (entreprises <11 salaries).',
      },
      budget_annuel_max: {
        value: 7500,
        confidence: 'exact',
        source_url: SRC_PHARMA,
        note: 'Budget annuel 2026 : 7 500 euros HT (<11 sal.), 15 000 euros HT (11+ sal.). Demandes avant le 30 novembre.',
      },
      budget_annuel_description: "Pharmacie d'officine 2026 : 7 500 euros HT/an (<11 sal.), 15 000 euros HT/an (11+ sal.). Duree max par action : 28 h. Demande avant le 30/11.",
      plafonds_par_taille: [
        {
          taille: 'less_11',
          cout_horaire_max: 40,
          budget_annuel_max: 7500,
          quota_horaire_max: null,
          description: 'Pharmacie <11 salaries : 7 500 euros HT/an, 40 euros/h (metier) ou 25 euros/h (transversal), salaire 12 euros/h, frais annexes couverts.',
        },
        {
          taille: '11_49',
          cout_horaire_max: 40,
          budget_annuel_max: 15000,
          quota_horaire_max: null,
          description: 'Pharmacie 11-49 salaries : 15 000 euros HT/an. Salaire et frais annexes reserves aux <11 salaries.',
        },
        {
          taille: '50_299',
          cout_horaire_max: 40,
          budget_annuel_max: 15000,
          quota_horaire_max: null,
          description: 'Pharmacie 50+ salaries : 15 000 euros HT/an (baremes 11+ sal.).',
        },
        {
          taille: '300_plus',
          cout_horaire_max: 40,
          budget_annuel_max: 15000,
          quota_horaire_max: null,
          description: 'Pharmacie 300+ salaries : 15 000 euros HT/an (baremes 11+ sal.).',
        },
      ],
    },
  ],
};

for (const [slug, variantes] of Object.entries(VARIANTES)) {
  const file = join(dir, `${slug}.json`);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  data.variantes_branche = variantes;
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log(`${slug}: ${variantes.length} variante(s) de branche`);
}
console.log('Terminé.');
