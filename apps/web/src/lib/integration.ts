// ============================================================
// Mode intégré : le site affiché dans un cadre (iframe) d'un autre site, par exemple une page WordPress de SFG
// Développement. Dans un cadre, le site masque son en-tête, sa navigation et son pied de page (globals.css,
// `html[data-integre]`) : la page qui l'héberge porte déjà les siens. Ouvert seul, le site reste complet.
//
// La détection tient en une ligne exécutée avant l'affichage (layout.tsx, dans l'en-tête du document) : sans elle,
// l'en-tête apparaîtrait un instant avant d'être masqué. Elle ne lit ni ne pose rien d'autre que l'attribut : aucun
// stockage, aucun cookie, aucune requête (le site promet de ne rien conserver). Tests : tests/integration.test.ts.
// ============================================================

/** Attribut posé sur la racine du document quand la page est dans un cadre. */
export const ATTRIBUT_INTEGRE = 'data-integre';

/**
 * Script en ligne : la page est dans un cadre quand sa fenêtre n'est pas la fenêtre du sommet. Si le navigateur refuse
 * de lire le sommet, la page est aussi dans un cadre (d'un autre domaine).
 */
export const SCRIPT_DETECTION_INTEGRATION =
  `try{if(window.self!==window.top)document.documentElement.setAttribute('${ATTRIBUT_INTEGRE}','')}` +
  `catch(e){document.documentElement.setAttribute('${ATTRIBUT_INTEGRE}','')}`;
