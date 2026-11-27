// ============================================================
// Image de partage (Open Graph, 1 200 x 630) générée au build par `next/og` : filet tricolore de la charte, logo SFG,
// surtitre, titre de la page en Montserrat 700, pied avec l'adresse du site. Utilisée par les fichiers
// `opengraph-image.tsx` (racine de `app`, fiches des OPCO, guides). Polices statiques de `assets/polices` (licence SIL
// Open Font License 1.1, déjà citée dans les mentions légales) : `next/og` ne lit ni le woff2 ni les polices variables.
// ============================================================

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const TAILLE_IMAGE = { width: 1200, height: 630 };
export const TYPE_IMAGE = 'image/png';

/* Jetons de la charte (DESIGN.md, section 2). */
const TEXTE = '#1A1A1A';
const TEXTE_DOUX = '#44514E';
const TURQUOISE = '#5E9F92';
const TURQUOISE_FONCE = '#3E6860';
const OR = '#F9B233';
const ORANGE = '#E84E1B';
const ORANGE_FONCE = '#C43F13';
const LIN_DOUX = '#F3F7F6';

/* Fichiers lus au build (process.cwd() vaut apps/web). Chemins écrits en entier : un chemin calculé ferait tracer tout
   le projet par Turbopack (avertissement « unexpected file in NFT list »). */
const police = (nom: string) => readFile(join(process.cwd(), 'assets', 'polices', nom));

export interface ContenuDImage {
  /** Ligne courte au-dessus du titre (« Fiche OPCO · barèmes vérifiés le 27/11/2026 »). */
  surtitre: string;
  /** Titre de la page, 90 caractères au plus pour tenir sur trois lignes. */
  titre: string;
  /** Pastille du pied (par défaut : simulateur gratuit et sources officielles). */
  pastille?: string;
}

export async function imageDePartage({ surtitre, titre, pastille }: ContenuDImage): Promise<ImageResponse> {
  const [montserrat, inter500, inter600, logo] = await Promise.all([
    police('montserrat-700-latin.ttf'),
    police('inter-500-latin.ttf'),
    police('inter-600-latin.ttf'),
    readFile(join(process.cwd(), 'public', 'logo-sfg.png')),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;
  const taillePolice = titre.length > 60 ? 58 : 66;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#FFFFFF',
          fontFamily: 'Inter',
          color: TEXTE,
        }}
      >
        <div style={{ display: 'flex', height: 14, width: '100%' }}>
          <div style={{ flex: 1, backgroundColor: TURQUOISE }} />
          <div style={{ flex: 1, backgroundColor: OR }} />
          <div style={{ flex: 1, backgroundColor: ORANGE }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '52px 72px 56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- next/og ne connaît que la balise img */}
            <img src={logoSrc} width={171} height={90} alt="" />
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, color: TEXTE_DOUX }}>financementopco.fr</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
            <div
              style={{
                display: 'flex',
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: TURQUOISE_FONCE,
              }}
            >
              {surtitre}
            </div>
            <div
              style={{
                display: 'flex',
                marginTop: 22,
                fontFamily: 'Montserrat',
                fontSize: taillePolice,
                fontWeight: 700,
                lineHeight: 1.12,
                letterSpacing: -1.5,
                maxWidth: 1020,
              }}
            >
              {titre}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 26px',
                borderRadius: 999,
                backgroundColor: LIN_DOUX,
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              <div style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: ORANGE }} />
              {pastille ?? 'Simulateur gratuit · sources officielles'}
            </div>
            <div style={{ display: 'flex', fontSize: 24, fontWeight: 500, color: ORANGE_FONCE }}>
              Un service SFG Développement
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...TAILLE_IMAGE,
      fonts: [
        { name: 'Montserrat', data: montserrat, weight: 700, style: 'normal' },
        { name: 'Inter', data: inter500, weight: 500, style: 'normal' },
        { name: 'Inter', data: inter600, weight: 600, style: 'normal' },
      ],
    },
  );
}
