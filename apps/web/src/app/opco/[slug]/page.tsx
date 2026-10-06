import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ALL_OPCOS, getOpcoBySlug } from '../../../../data/opcos';
import type { Confidence, OpcoData, SourcedValue } from '@/lib/types';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { SourceBadge } from '@/components/ui/SourceBadge';

export function generateStaticParams() {
  return ALL_OPCOS.map((o) => ({ slug: o.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const opco = getOpcoBySlug(slug);
  if (!opco) return {};
  return {
    title: `${opco.name} : barèmes de financement 2026, conditions, dispositifs`,
    description: `Critères de prise en charge 2026 de ${opco.name} (${opco.secteurs}) : coûts pédagogiques, salaires, frais annexes, actions collectives, avec sources officielles.`,
  };
}

/** Certains champs JSON sont des chaînes, d'autres des objets { description, note } */
function asText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.description === 'string') return o.description;
    if (typeof o.note === 'string') return o.note;
  }
  return null;
}

function BaremeRow({
  label,
  sourced,
  unit,
}: {
  label: string;
  sourced: SourcedValue<number | null> | undefined;
  unit: string;
}) {
  if (!sourced) return null;
  return (
    <tr>
      <td className="px-4 py-3 align-top font-medium text-ink">{label}</td>
      <td className="amount px-4 py-3 text-right align-top">
        {sourced.value != null ? (
          <span className="font-semibold">
            {sourced.value.toLocaleString('fr-FR')} {unit}
          </span>
        ) : (
          <span className="text-ink-faint">non publié</span>
        )}
      </td>
      <td className="px-4 py-3 text-center align-top">
        <ConfidenceBadge confidence={sourced.confidence as Confidence} />
      </td>
      <td className="hidden px-4 py-3 align-top text-xs leading-relaxed text-ink-faint md:table-cell">
        {sourced.note}
      </td>
      <td className="px-4 py-3 text-center align-top">
        {sourced.source_url && <SourceBadge url={sourced.source_url} />}
      </td>
    </tr>
  );
}

export default async function OpcoFichePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const opco = getOpcoBySlug(slug) as OpcoData | undefined;
  if (!opco) notFound();

  const alternanceApprentissage = asText(opco.alternance_apprentissage);
  const alternanceProf = asText(opco.alternance_professionnalisation);
  const cpfDetails = asText(opco.cpf_details);
  const vaeDetails = asText(opco.vae_details);

  return (
    <main>
      {/* En-tête fiche */}
      <header className="border-b border-ink">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-14">
          <nav className="marginalia mb-4" aria-label="Fil d'ariane">
            <Link href="/opco" className="hover:text-cobalt hover:underline">
              Les 11 OPCO
            </Link>{' '}
            / {opco.name}
          </nav>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {opco.name}
          </h1>
          {opco.nom_complet && (
            <p className="mt-1 text-lg font-medium text-ink-soft">{opco.nom_complet}</p>
          )}
          <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">{opco.secteurs}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <a
              href={opco.url_finance_page}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-cobalt px-4 py-2 font-semibold text-white hover:bg-navy"
            >
              Critères officiels {opco.name} ↗
            </a>
            <Link
              href="/simulateur"
              className="rounded border border-ink px-4 py-2 font-semibold hover:bg-paper-deep"
            >
              Simuler un financement
            </Link>
          </div>
          {opco.derniere_verification && (
            <p className="marginalia mt-4">
              Données vérifiées le {opco.derniere_verification}
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:px-6">
        {/* Barèmes */}
        <section>
          <div className="rule-double pt-5">
            <h2 className="font-display text-2xl font-bold">
              Barèmes du plan de développement des compétences
            </h2>
          </div>
          <p className="mt-3 max-w-3xl text-sm text-ink-soft">
            Montants publiés par {opco.name}{' '}pour 2026. « Non publié » signifie que
            l&apos;OPCO ne communique pas de barème national : le montant dépend de votre
            branche, contactez votre conseiller.
          </p>
          <div className="mt-5 overflow-x-auto rounded border border-rule bg-white">
            <table className="w-full text-sm">
              <thead className="bg-paper-deep">
                <tr>
                  <th className="marginalia px-4 py-3 text-left">Poste</th>
                  <th className="marginalia px-4 py-3 text-right">Montant</th>
                  <th className="marginalia px-4 py-3 text-center">Fiabilité</th>
                  <th className="marginalia hidden px-4 py-3 text-left md:table-cell">Précision</th>
                  <th className="marginalia px-4 py-3 text-center">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                <BaremeRow label="Coût pédagogique (inter-entreprises)" sourced={opco.cout_horaire_inter} unit="€/h" />
                <BaremeRow label="Coût pédagogique (intra-entreprise)" sourced={opco.cout_horaire_intra} unit="€/h" />
                <BaremeRow label="Coût pédagogique (formations métier)" sourced={opco.cout_horaire_metier} unit="€/h" />
                <BaremeRow label="Prise en charge des salaires" sourced={opco.prise_en_charge_salaires} unit={opco.prise_en_charge_salaires_mode === 'pourcentage_pedagogique' ? '%' : '€/h'} />
                <BaremeRow label="Frais de transport" sourced={opco.frais_transport} unit="€/jour" />
                <BaremeRow label="Frais d'hébergement" sourced={opco.frais_hebergement} unit="€/nuit" />
                <BaremeRow label="Frais de restauration" sourced={opco.frais_restauration} unit="€/repas" />
                <BaremeRow label="Budget annuel maximum" sourced={opco.budget_annuel_max} unit="€/an" />
              </tbody>
            </table>
          </div>
          {opco.budget_annuel_description && (
            <p className="mt-3 text-sm text-ink-soft">
              <strong>Budget annuel :</strong> {opco.budget_annuel_description}
            </p>
          )}
        </section>

        {/* Plafonds par taille */}
        {opco.plafonds_par_taille && opco.plafonds_par_taille.length > 0 && (
          <section>
            <div className="rule-double pt-5">
              <h2 className="font-display text-2xl font-bold">Selon la taille de l&apos;entreprise</h2>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {opco.plafonds_par_taille.map((p) => (
                <div key={p.taille} className="rounded border border-rule bg-white p-4">
                  <div className="marginalia">
                    {p.taille === 'less_11' && 'Moins de 11 salariés'}
                    {p.taille === '11_49' && '11 à 49 salariés'}
                    {p.taille === '50_299' && '50 à 299 salariés'}
                    {p.taille === '300_plus' && '300 salariés et plus'}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{p.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Dispositifs sans impact budget */}
        {opco.dispositifs_sans_budget && opco.dispositifs_sans_budget.length > 0 && (
          <section>
            <div className="rule-double pt-5">
              <h2 className="font-display text-2xl font-bold">
                Se former sans toucher au budget
              </h2>
            </div>
            <p className="mt-3 max-w-3xl text-sm text-ink-soft">
              Dispositifs financés sur les fonds propres ou mutualisés de l&apos;OPCO : ils ne
              consomment pas l&apos;enveloppe annuelle de votre entreprise.{' '}
              <Link href="/former-sans-budget" className="text-cobalt underline">
                Comprendre comment ça marche →
              </Link>
            </p>
            <div className="mt-5 space-y-4">
              {opco.dispositifs_sans_budget.map((d) => (
                <div key={d.nom} className="rounded border border-valid/40 bg-valid-soft p-5">
                  <h3 className="font-display font-bold text-valid">{d.nom}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{d.description}</p>
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-semibold text-valid underline"
                  >
                    {d.url.replace('https://', '').split('/')[0]} ↗
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Alternance, CPF, VAE */}
        <section>
          <div className="rule-double pt-5">
            <h2 className="font-display text-2xl font-bold">Alternance, CPF et VAE</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {alternanceApprentissage && (
              <div className="rounded border border-rule bg-white p-4">
                <div className="marginalia">Apprentissage</div>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{alternanceApprentissage}</p>
              </div>
            )}
            {alternanceProf && (
              <div className="rounded border border-rule bg-white p-4">
                <div className="marginalia">Professionnalisation</div>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{alternanceProf}</p>
              </div>
            )}
            {opco.cpf_abondement && cpfDetails && (
              <div className="rounded border border-rule bg-white p-4">
                <div className="marginalia">Abondement CPF</div>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{cpfDetails}</p>
              </div>
            )}
            {opco.vae_possible && vaeDetails && (
              <div className="rounded border border-rule bg-white p-4">
                <div className="marginalia">VAE</div>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{vaeDetails}</p>
              </div>
            )}
          </div>
        </section>

        {/* Conditions pratiques */}
        <section>
          <div className="rule-double pt-5">
            <h2 className="font-display text-2xl font-bold">En pratique</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded border border-rule bg-white p-4">
              <div className="marginalia">Demande</div>
              <p className="mt-2 text-sm text-ink-soft">{opco.processus_approbation}</p>
            </div>
            {opco.delai_validation && (
              <div className="rounded border border-rule bg-white p-4">
                <div className="marginalia">Délai de validation</div>
                <p className="mt-2 text-sm text-ink-soft">{opco.delai_validation}</p>
              </div>
            )}
            {opco.mode_paiement && (
              <div className="rounded border border-rule bg-white p-4">
                <div className="marginalia">Mode de paiement</div>
                <p className="mt-2 text-sm text-ink-soft">{opco.mode_paiement}</p>
              </div>
            )}
          </div>
          {opco.specificites && (
            <div className="mt-4 rounded border border-cobalt/40 bg-cobalt-soft p-4">
              <div className="marginalia !text-navy">À savoir</div>
              <p className="mt-2 text-sm leading-relaxed text-navy">{opco.specificites}</p>
            </div>
          )}
          {opco.points_cles_maximisation && (
            <div className="mt-4 rounded border border-valid/40 bg-valid-soft p-4">
              <div className="marginalia !text-valid">Maximiser la prise en charge</div>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{opco.points_cles_maximisation}</p>
            </div>
          )}
        </section>

        {/* Disclaimer */}
        <div className="rounded border border-rule bg-paper-deep p-4 text-center text-xs leading-relaxed text-ink-soft">
          Les barèmes de {opco.name} varient selon les branches professionnelles et peuvent être
          révisés en cours d&apos;année, dans la limite des fonds disponibles. Seul {opco.name}{' '}
          confirme une prise en charge après étude du dossier.
        </div>
      </div>
    </main>
  );
}
