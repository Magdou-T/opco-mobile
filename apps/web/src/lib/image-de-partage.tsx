// ============================================================
// Image de partage (Open Graph, 1 200 x 630) générée au build par `next/og`, sur le gabarit du kit d'identité
// (reference/image-de-partage.html) : fond papier, logo financementopco, surtitre en DM Mono, titre de la page en
// Newsreader 500, pied en DM Mono. L'accueil garde l'image dessinée du kit (app/opengraph-image.png) ; chaque autre page
// a la sienne, par ses fichiers `opengraph-image.tsx`. Polices statiques de `assets/polices` (licence SIL Open Font
// License 1.1) : `next/og` ne lit ni le woff2 ni les polices variables.
// ============================================================

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const TAILLE_IMAGE = { width: 1200, height: 630 };
export const TYPE_IMAGE = 'image/png';

/* Jetons de la charte (DESIGN.md, section 2). */
const PAPIER = '#F4F1E9';
const FEUILLE = '#FBF9F4';
const FILET = '#CFC8B8';
const ENCRE = '#161C27';
const ARDOISE = '#4A5262';
const SURLIGNEUR = '#F1D84B';

/* Fichiers lus au build (process.cwd() vaut apps/web). Chemins écrits en entier : un chemin calculé ferait tracer tout
   le projet par Turbopack (avertissement « unexpected file in NFT list »). */
const police = (nom: string) => readFile(join(process.cwd(), 'assets', 'polices', nom));

export interface ContenuDImage {
  /** Ligne courte au-dessus du titre (« Fiche OPCO · barèmes vérifiés le 27/11/2026 »). */
  surtitre: string;
  /** Titre de la page, 90 caractères au plus pour tenir sur trois lignes. */
  titre: string;
  /** Ligne du pied (par défaut : simulateur gratuit, sans inscription). */
  pastille?: string;
}

export async function imageDePartage({ surtitre, titre, pastille }: ContenuDImage): Promise<ImageResponse> {
  const [newsreader, instrument, mono400, mono500, logo] = await Promise.all([
    police('newsreader-500.ttf'),
    police('instrument-sans-400.ttf'),
    police('dm-mono-400.ttf'),
    police('dm-mono-500.ttf'),
    readFile(join(process.cwd(), 'public', 'logo-horizontal.svg')),
  ]);
  const logoSrc = `data:image/svg+xml;base64,${logo.toString('base64')}`;
  const taillePolice = titre.length > 60 ? 62 : 72;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px 52px',
          backgroundColor: PAPIER,
          color: ENCRE,
          fontFamily: 'Instrument Sans',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og ne connaît que la balise img */}
          <img src={logoSrc} width={300} height={59} alt="" />
          <div
            style={{
              display: 'flex',
              fontFamily: 'DM Mono',
              fontSize: 18,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: ARDOISE,
              border: `1.5px solid ${ARDOISE}`,
              borderRadius: 2,
              padding: '6px 12px',
            }}
          >
            Sources officielles
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontFamily: 'DM Mono', fontSize: 22, color: ARDOISE }}>{surtitre}</div>
          <div
            style={{
              display: 'flex',
              marginTop: 18,
              paddingBottom: 26,
              borderBottom: `2px solid ${ENCRE}`,
              fontFamily: 'Newsreader',
              fontSize: taillePolice,
              fontWeight: 500,
              lineHeight: 1.06,
              letterSpacing: -1.4,
              maxWidth: 1060,
            }}
          >
            {titre}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'DM Mono', fontSize: 20 }}>
            <div
              style={{
                display: 'flex',
                padding: '4px 10px',
                backgroundColor: FEUILLE,
                border: `1px solid ${FILET}`,
                boxShadow: `inset 0 -10px 0 ${SURLIGNEUR}`,
                fontWeight: 500,
              }}
            >
              financementopco.fr
            </div>
            <div style={{ display: 'flex', color: ARDOISE }}>{pastille ?? 'Simulateur gratuit, sans inscription'}</div>
          </div>
        </div>
      </div>
    ),
    {
      ...TAILLE_IMAGE,
      fonts: [
        { name: 'Newsreader', data: newsreader, weight: 500, style: 'normal' },
        { name: 'Instrument Sans', data: instrument, weight: 400, style: 'normal' },
        { name: 'DM Mono', data: mono400, weight: 400, style: 'normal' },
        { name: 'DM Mono', data: mono500, weight: 500, style: 'normal' },
      ],
    },
  );
}
