/**
 * Filet tricolore turquoise / or / orange (les trois soulignés du slogan de marque, comme au pied de page) en tête du
 * bandeau de synthèse et de son squelette d'attente (`ChargementResultats`). Un seul dessin pour les deux : le contenu du
 * squelette et celui du bandeau partent de la même hauteur, rien ne bouge à l'arrivée de l'écran. Décor, non imprimé.
 */
export function FiletTricolore() {
  return (
    <div aria-hidden="true" className="decor flex h-1.5">
      <span className="flex-1 bg-turquoise" />
      <span className="flex-1 bg-or" />
      <span className="flex-1 bg-orange" />
    </div>
  );
}
