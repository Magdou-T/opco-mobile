import { describe, it, expect } from 'vitest';
import { EMBEDDED_OPCOS } from '../src/data';
import { OpcoDataSchema, sanityCheckOpco } from '../src/schema';

const CHAMPS_CHIFFRES = [
  'cout_horaire_inter',
  'cout_horaire_intra',
  'cout_horaire_metier',
  'prise_en_charge_salaires',
  'frais_transport',
  'frais_hebergement',
  'frais_restauration',
  'frais_annexes_pourcentage',
  'budget_annuel_max',
] as const;

/** Nombre de mois entiers écoulés depuis une date AAAA-MM-JJ (horloge du test). */
function moisDepuis(date: string): number {
  const d = new Date(`${date}T00:00:00Z`);
  const maintenant = new Date();
  return (maintenant.getUTCFullYear() - d.getUTCFullYear()) * 12 + (maintenant.getUTCMonth() - d.getUTCMonth());
}

describe('barèmes OPCO embarqués', () => {
  it('respectent le schéma (une seule entrée par taille) et les bornes', () => {
    for (const o of EMBEDDED_OPCOS) {
      const parsed = OpcoDataSchema.safeParse(o);
      expect(parsed.success, `${o.slug} : ${parsed.success ? '' : JSON.stringify(parsed.error.issues)}`).toBe(true);
      if (parsed.success) expect(sanityCheckOpco(parsed.data)).toEqual([]);
    }
  });

  it('ont été vérifiés il y a moins de 12 mois', () => {
    for (const o of EMBEDDED_OPCOS) {
      expect(o.derniere_verification, o.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(moisDepuis(o.derniere_verification!), o.slug).toBeLessThan(12);
    }
  });

  it('chaque montant « exact » cite une source https et un extrait entre guillemets', () => {
    for (const o of EMBEDDED_OPCOS) {
      for (const champ of CHAMPS_CHIFFRES) {
        const v = o[champ];
        if (v.value != null && v.confidence === 'exact') {
          expect(v.source_url, `${o.slug}.${champ}`).toMatch(/^https:\/\//);
          expect(v.note ?? '', `${o.slug}.${champ}`).toMatch(/«[^»]+»/);
        }
      }
    }
  });

  it('une enveloppe 50+ est toujours décrite', () => {
    for (const o of EMBEDDED_OPCOS) {
      for (const p of o.plafonds_par_taille ?? []) {
        if ((p.taille === '50_299' || p.taille === '300_plus') && p.budget_annuel_max != null) {
          expect(p.description.length, `${o.slug}.${p.taille}`).toBeGreaterThan(20);
        }
      }
    }
  });

  it("les alertes citent une source https, un extrait et une date", () => {
    for (const o of EMBEDDED_OPCOS) {
      for (const a of o.alertes ?? []) {
        expect(a.source_url, `${o.slug} ${a.branche}`).toMatch(/^https:\/\//);
        expect(a.extrait.length, `${o.slug} ${a.branche}`).toBeGreaterThan(10);
        expect(a.verifie_le, `${o.slug} ${a.branche}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});
