# Research protocol — French training-funding aids catalog (READ FULLY BEFORE STARTING)

## Context
We are building "Financement OPCO", a French mobile app (Expo/React Native) that tells a company or a person
which public aids and funding can pay for a vocational training project in France, and estimates amounts.
**Today is 2026-10-05.** Your training data may be outdated: rules changed a lot in 2025-2026 (loi de finances 2026,
apprenticeship aid reforms, CPF changes, "période de reconversion" since 1 Feb 2026, France Travail, regional budget cuts).
**Verify everything on the live web today.** Users will rely on this data: a wrong amount is worse than no amount.

## Absolute rules
1. **Official sources only** for any fact: legifrance.gouv.fr, service-public.fr (incl. entreprendre.service-public.gouv.fr),
   travail-emploi.gouv.fr, francetravail.fr / francetravail.org, moncompteformation.gouv.fr, francecompetences.fr,
   transitionspro.fr and regional Transitions Pro sites, agefiph.fr, fse.gouv.fr, europa.eu, erasmusplus.fr / agence-erasmus.fr,
   urssaf.fr, impots.gouv.fr, bofip.impots.gouv.fr, economie.gouv.fr, OPCO websites, FAF websites (agefice.fr, fafcea.com,
   fifpl.fr, vivea.fr, fafpm.org), regional council websites (e.g. iledefrance.fr, hautsdefrance.fr…), Carif-Oref websites,
   1jeune1solution.gouv.fr, alternance.emploi.gouv.fr, vae.gouv.fr (France VAE), data.gouv.fr.
   Private blogs / training-company marketing pages may ONLY be used to discover official URLs, never as evidence.
2. **Every number** (amount, %, cap, €/h, hours, age limit, headcount threshold, seniority, date) must be backed by a
   **verbatim extract** (≤ 300 characters, copied exactly, in French) from an official page **you actually opened today**,
   with its URL. Put it in `sources[].extrait`.
3. **Never invent, extrapolate, or "round"**. If you cannot confirm a value from an official source fetched today:
   use `"statut": "a_confirmer"` and `"montant": {"mode": "non_chiffre", ...}` and explain in `cumul.note` or a condition.
4. If a scheme has **ended, is suspended, or has no 2026 funding / no new applications**, do NOT put it in `aides`.
   List it in `exclues` with the official evidence (URL + extract). This is important: we must not present dead schemes.
5. If an amount only applies when a **non-checkable condition** holds (e.g. the training must be in a specific regional
   catalogue, the jury must approve), use `"mode": "non_chiffre"` and describe the rule in `montant.libelle`
   (e.g. "Formation gratuite si elle figure au programme régional") — never claim 100 % coverage unconditionally.
6. All user-facing text (`nom`, `description`, `conditions`, `demarches`, `montant.libelle`, notes) **in French**,
   concise, factual, no marketing, no emojis.

## Fetching tips (Windows machine, Git Bash available)
- Try `WebFetch` first. If blocked/empty (Cloudflare, JS-only), use Bash:
  `curl -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36" "<url>" -o page.html`
  then extract text with python, or WebFetch on `https://r.jina.ai/<url>`, or the firecrawl CLI if installed (`firecrawl scrape <url>`).
- PDFs: download with curl, extract text with python `pypdf` (installed):
  `python -c "import pypdf;r=pypdf.PdfReader('f.pdf');print('\n'.join(p.extract_text() or '' for p in r.pages))"`
- Use WebSearch to find official pages (restrict with allowed_domains when useful).
- Work in your own sub-folder of the research directory for temp files.

## Output format
Write ONE JSON file (UTF-8, pretty-printed) at the path given in your task:
```json
{
  "meta": { "perimetre": "...", "date_verification": "2026-10-05", "auteur": "agent <name>", "nb_aides": 0 },
  "aides": [ /* Aide objects, schema below */ ],
  "portails": [ /* PortailRegional objects (regional tasks only) */ ],
  "exclues": [ { "nom": "...", "raison": "...", "sources": [ { "url": "...", "titre": "...", "extrait": "..." } ] } ],
  "notes": [ "free-form remarks for the integrator (French), e.g. doubts, pages unreachable" ]
}
```
Before finishing, validate: `python -c "import json;d=json.load(open(r'<path>',encoding='utf-8'));print(len(d['aides']))"`
and check every aide has ≥1 source with https URL and a non-empty extrait, ids are unique, enums are valid.

## Schema (TypeScript notation; JSON keys exactly as below)
```ts
type ProjetType = 'formation_salarie' | 'reconversion_salarie' | 'recrutement_demandeur_emploi' | 'alternance' | 'formation_dirigeant';
// formation_salarie: an employer trains a current employee (upskilling)
// reconversion_salarie: an employee changes job/trade (inside or outside the company)
// recrutement_demandeur_emploi: a company recruits a jobseeker and trains them before/at hiring
// alternance: apprenticeship or professionalisation contract
// formation_dirigeant: training of the company owner/manager (non-salaried or assimilated)
type StatutBeneficiaire = 'salarie' | 'demandeur_emploi' | 'alternant' | 'dirigeant'; // who follows the training / is hired
type Financeur = 'etat' | 'region' | 'departement' | 'france_travail' | 'transitions_pro' | 'agefiph' | 'europe' | 'cpf' | 'opco' | 'faf' | 'fiscal' | 'branche' | 'autre';
type CategorieAide =
  | 'cout_formation'            // directly reduces the training cost (pedagogy, travel/lodging)
  | 'aide_employeur'            // money paid to the employer (hiring aid, salary reimbursement)
  | 'remuneration_beneficiaire' // income for the trainee during training
  | 'avantage_fiscal_social'    // tax credit, social-contribution exemptions
  | 'service_gratuit';          // free advice/diagnosis/support (no amount)
type CodeRegion = '84'|'27'|'53'|'24'|'94'|'44'|'32'|'11'|'28'|'75'|'76'|'52'|'93'|'01'|'02'|'03'|'04'|'06';
// 84 Auvergne-Rhône-Alpes, 27 Bourgogne-Franche-Comté, 53 Bretagne, 24 Centre-Val de Loire, 94 Corse,
// 44 Grand Est, 32 Hauts-de-France, 11 Île-de-France, 28 Normandie, 75 Nouvelle-Aquitaine, 76 Occitanie,
// 52 Pays de la Loire, 93 Provence-Alpes-Côte d'Azur, 01 Guadeloupe, 02 Martinique, 03 Guyane, 04 La Réunion, 06 Mayotte
type NiveauDiplome = 'sans_diplome' | 'cap_bep' | 'bac' | 'bac_plus_2' | 'bac_plus_3_et_plus'; // highest diploma held by the trainee
type NiveauCertification = 3 | 4 | 5 | 6 | 7 | 8; // level of the TARGETED certification (3=CAP, 4=Bac, 5=Bac+2, 6=Bac+3/4, 7=Bac+5, 8=Doctorat)
type StatutDirigeant = 'commercant' | 'artisan' | 'profession_liberale' | 'exploitant_agricole' | 'assimile_salarie';
type TypeStructure = 'ess' | 'siae' | 'association';
type ContractType = 'cdi' | 'cdd' | 'interim' | 'alternance';
type CertificationType = 'rncp' | 'rs' | 'cqp' | 'diplome' | 'habilitation' | 'aucune' | 'autre';
type Confidence = 'exact' | 'estimated' | 'depends_on_branche';

interface Aide {
  id: string;                // kebab-case unique. Prefixes: national 'nat-', Europe 'ue-', FAF 'faf-', fiscal 'fis-', region 'r<code>-' (e.g. 'r11-aire')
  nom: string;               // official name
  financeur: Financeur;
  financeur_nom: string;     // e.g. 'Région Île-de-France', 'France Travail', 'Agefiph'
  categorie: CategorieAide;
  projets: ProjetType[];     // ≥1 — every project type where this aid can apply
  beneficiaires: StatutBeneficiaire[]; // ≥1
  description: string;       // 1-3 sentences, what it is and what it pays
  criteres: CriteresAide;    // ONLY machine-checkable criteria (see below); everything else goes to `conditions`
  conditions: string[];      // other eligibility conditions, displayed to the user as a checklist
  montant: MontantAide;
  cumul: RegleCumul;
  demarches: string[];       // ≥1 concrete step, in order (who to contact, which platform, when: before training start…)
  url_demarche: string | null;  // official page/platform to apply
  liens_par_region?: { [code in CodeRegion]?: string }; // for national schemes run regionally (Transitions Pro, Agefiph délégations…)
  sources: { url: string; titre: string; extrait: string }[]; // ≥1; extrait verbatim ≤300 chars proving the key facts/amounts
  derniere_verification: string;  // 'YYYY-MM-DD' (the date you verified)
  validite: { debut: string | null; fin: string | null }; // known validity window (YYYY-MM-DD) else nulls
  statut: 'actif' | 'a_confirmer' | 'suspendu';
  confidence: Confidence;    // 'exact' = amounts verbatim from an official 2026 source; 'estimated' = official but dated/ambiguous; 'depends_on_branche' = depends on branch/case
  ordre_empilement?: number; // optional; leave out unless you have a reason
}
interface CriteresAide {     // all optional; omit a key when there is no constraint
  regions?: CodeRegion[];    // restrict to these regions
  perimetre_region?: 'entreprise' | 'beneficiaire'; // whose location matters (default 'entreprise'; jobseeker aids usually 'beneficiaire')
  departements?: string[];   // INSEE dept codes ('75','2A','971'…)
  effectif_min?: number; effectif_max?: number; // company headcount bounds, inclusive (e.g. "moins de 250 salariés" → effectif_max: 249)
  age_min?: number; age_max?: number;           // trainee age bounds, inclusive (e.g. "moins de 30 ans" → age_max: 29)
  rqth?: boolean;            // true = only for people with disability recognition (RQTH / BOETH)
  niveaux_diplome?: NiveauDiplome[];            // trainee must hold one of these as highest diploma
  niveau_certification_max?: NiveauCertification; niveau_certification_min?: NiveauCertification;
  contrats?: ContractType[];
  types_alternance?: ('apprentissage' | 'professionnalisation')[];
  anciennete_min_mois?: number;
  inscrit_france_travail?: boolean;             // true = must be registered jobseeker
  statuts_dirigeant?: StatutDirigeant[];
  micro_entrepreneur?: boolean;                 // true = only micro-entrepreneurs; false = excludes them
  certifications?: CertificationType[];         // training must lead to one of these
  eligible_cpf?: boolean;                       // training must be CPF-eligible
  duree_min_heures?: number; duree_max_heures?: number;
  opcos?: string[];          // OPCO slugs: afdas, akto, atlas, constructys, ocapiat, opco-ep, opco-mobilites, opco-sante, opco2i, opcommerce, uniformation
  idcc?: string[]; naf_prefixes?: string[];
  structures?: TypeStructure[];                 // employer must be one of these
  qualiopi_requis?: boolean;                    // training provider must be Qualiopi-certified
}
interface MontantAide {
  mode: 'forfait' | 'pourcentage' | 'par_heure' | 'par_mois' | 'solde_cpf' | 'non_chiffre';
  valeur: number | null;     // euros for forfait / par_heure / par_mois
  pourcentage: number | null;// for mode 'pourcentage' (0-100)
  base: 'cout_pedagogique' | 'cout_total' | null; // base of the percentage
  plafond: number | null;    // cap in euros if any
  duree_max_mois: number | null; // for par_mois
  libelle: string;           // the rule in plain French, e.g. "5 000 € pour la 1re année du contrat"
  majorations?: { criteres: CriteresAide; valeur?: number | null; pourcentage?: number | null; plafond?: number | null; libelle: string }[];
  // majorations: alternative amounts when extra criteria hold (e.g. RQTH → higher amount). First matching one applies.
}
interface RegleCumul { cumulable: boolean; alternatives?: string[]; note?: string } // alternatives = ids of aids that are "either/or" with this one

interface PortailRegional {   // regional tasks only: one per region
  region: CodeRegion; nom_region: string;
  liens: { titre: string; url: string; type: 'region' | 'carif_oref' | 'transitions_pro' | 'france_travail' | 'agefiph' | 'autre' }[];
  derniere_verification: string;
}
```

## Quality checklist (do it before finishing)
- [ ] Every aid is currently active for new applications in October 2026 (or marked `a_confirmer` with explanation).
- [ ] Every number appears verbatim in an extract.
- [ ] Criteria are faithful (inclusive bounds converted correctly: "moins de 30 ans" → age_max 29; "jusqu'à 29 ans révolus" → age_max 29).
- [ ] Nothing duplicated across ids; no OPCO-specific schemes (they are handled elsewhere) unless the task says so.
- [ ] `exclues` lists dead/suspended schemes you encountered (with evidence) — very useful.
- [ ] JSON parses; enums valid.
