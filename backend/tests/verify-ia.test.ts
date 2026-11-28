// ============================================================
// Tests de l'avis consultatif du modèle sur les écarts (verify.reviewDiffsWithModel).
// Le client Anthropic est remplacé par un double : aucun réseau, aucune clé réelle.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpcoDiff } from '../src/types';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create };
  },
}));

import { reviewDiffsWithModel } from '../src/verify';

const ecarts: OpcoDiff[] = [{ slug: 'atlas', diffs: [{ field: 'cout_horaire_inter', status: 'modified', oldValue: 25, newValue: 30 }] }];

describe('verify.reviewDiffsWithModel', () => {
  const cleInitiale = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'cle-factice-pour-les-tests';
    create.mockReset();
  });

  afterEach(() => {
    if (cleInitiale === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = cleInitiale;
  });

  it("laisse assez de jetons à la réflexion adaptative : max_tokens 16000 et effort bas", async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: '- atlas : plausible' }], stop_reason: 'end_turn' });
    await reviewDiffsWithModel(ecarts);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({ max_tokens: 16_000, thinking: { type: 'adaptive' }, output_config: { effort: 'low' } });
  });

  it("rend le texte de l'avis et journalise le motif d'arrêt du modèle", async () => {
    create.mockResolvedValue({
      content: [
        { type: 'thinking', thinking: '' },
        { type: 'text', text: '- atlas.cout_horaire_inter : plausible' },
      ],
      stop_reason: 'end_turn',
    });
    const avis = await reviewDiffsWithModel(ecarts);
    expect(avis).toContain('- atlas.cout_horaire_inter : plausible');
    expect(avis).toContain('stop_reason=end_turn');
  });

  it("signale un avis tronqué (stop_reason max_tokens) au lieu de le présenter comme complet", async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: '- atlas.cout_horaire_inter : plaus' }], stop_reason: 'max_tokens' });
    const avis = await reviewDiffsWithModel(ecarts);
    expect(avis).toContain('- atlas.cout_horaire_inter : plaus');
    expect(avis).toMatch(/tronqu/);
    expect(avis).toContain('stop_reason=max_tokens');
  });

  it("dit qu'aucun avis n'a été rendu quand la réponse ne contient aucun texte (tout le budget a servi à réfléchir)", async () => {
    create.mockResolvedValue({ content: [{ type: 'thinking', thinking: '' }], stop_reason: 'max_tokens' });
    const avis = await reviewDiffsWithModel(ecarts);
    expect(avis).toMatch(/Aucun texte/);
    expect(avis).toContain('stop_reason=max_tokens');
  });

  it("n'appelle pas le modèle sans clé d'API ni sans écart à examiner", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(await reviewDiffsWithModel(ecarts)).toMatch(/Pas de clé API/);
    process.env.ANTHROPIC_API_KEY = 'cle-factice-pour-les-tests';
    const inchanges: OpcoDiff[] = [{ slug: 'atlas', diffs: [{ field: 'cout_horaire_inter', status: 'unchanged', oldValue: 25, newValue: 25 }] }];
    expect(await reviewDiffsWithModel(inchanges)).toBe('Aucun écart à examiner.');
    expect(create).not.toHaveBeenCalled();
  });
});
