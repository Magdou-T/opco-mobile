'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { normaliserRecherche } from '@/lib/normaliser';

/**
 * Filtre du tableau des conventions collectives (page « Quel est mon OPCO ? »). Le tableau est rendu par le serveur, en
 * entier : sans JavaScript, il reste lisible et la recherche du navigateur (Ctrl+F) suffit. Ce composant masque seulement
 * les lignes qui ne correspondent pas à la saisie (attribut `hidden`, que React ne gère pas sur ces lignes) et annonce le
 * nombre de résultats. Aucune donnée n'est envoyée au navigateur en plus du tableau.
 */

export function RechercheIdcc({ idTableau, total }: { idTableau: string; total: number }) {
  const id = useId();
  const [requete, setRequete] = useState('');
  const [trouvees, setTrouvees] = useState<number | null>(null);
  // Texte normalisé de chaque ligne, calculé à la première recherche (le tableau ne change pas).
  const textes = useRef<Map<HTMLTableRowElement, string> | null>(null);

  useEffect(() => {
    const tableau = document.getElementById(idTableau);
    if (!tableau) return;
    const mots = normaliserRecherche(requete).split(' ').filter(Boolean);
    if (mots.length > 0 && textes.current === null) {
      textes.current = new Map(
        [...tableau.querySelectorAll<HTMLTableRowElement>('tbody tr')].map((l) => [l, normaliserRecherche(l.textContent ?? '')]),
      );
    }
    // Un code saisi sans ses zéros (« 16 ») se compare aussi au code sur quatre chiffres (« 0016 »).
    const codes = mots.map((m) => (/^\d{1,4}$/.test(m) ? m.padStart(4, '0') : null));
    let visibles = 0;
    tableau.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((ligne) => {
      const texte = textes.current?.get(ligne) ?? '';
      const code = ligne.id.replace('idcc-', '');
      const correspond = mots.every((m, i) => texte.includes(m) || (codes[i] !== null && code === codes[i]));
      ligne.hidden = !correspond;
      if (correspond) visibles += 1;
    });
    setTrouvees(mots.length > 0 ? visibles : null);
  }, [requete, idTableau]);

  return (
    <div className="max-w-xl">
      <label htmlFor={id} className="block text-sm font-semibold text-texte">
        Rechercher une convention collective
      </label>
      <p id={`${id}-aide`} className="mt-1 text-sm text-texte-discret">
        Code IDCC (par exemple 1486) ou mots de l&apos;intitulé (par exemple « boulangerie »).
      </p>
      <input
        id={id}
        type="search"
        inputMode="search"
        autoComplete="off"
        aria-describedby={`${id}-aide ${id}-resultat`}
        value={requete}
        onChange={(e) => setRequete(e.target.value)}
        className="mt-2 h-12 w-full rounded-xl border border-filet-fort bg-white px-4 text-base text-texte focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
      />
      <p id={`${id}-resultat`} aria-live="polite" className="mt-2 min-h-5 text-sm text-texte-doux">
        {trouvees === null
          ? `${total} conventions collectives dans le tableau.`
          : trouvees === 0
            ? "Aucune convention ne correspond : vérifiez le code, ou utilisez le simulateur avec le nom ou le SIREN de l'entreprise."
            : `${trouvees} convention${trouvees > 1 ? 's' : ''} sur ${total}.`}
      </p>
    </div>
  );
}
