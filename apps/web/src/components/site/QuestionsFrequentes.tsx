import { TitreDeSection } from '@/components/site/TitreDeSection';
import type { QuestionReponse } from '@/lib/donnees-structurees';
import { typo } from '@/lib/format';

/**
 * Questions fréquentes d'une page, toutes dépliées : chaque réponse est lisible sans clic, par le lecteur comme par les
 * moteurs et les assistants qui citent un passage. Les données structurées (`noeudFaq`) reprennent exactement ces mots :
 * la page passe le même tableau aux deux. Charte financementopco : une liste à filets, sans carte. Une question est un
 * `h3`, sa réponse un paragraphe. `sansTitre` : la section qui l'accueille porte déjà le titre (accueil).
 */
export function QuestionsFrequentes({
  questions,
  id = 'questions',
  titre = 'Questions fréquentes',
  sansTitre = false,
}: {
  questions: readonly QuestionReponse[];
  id?: string;
  titre?: string;
  sansTitre?: boolean;
}) {
  const liste = (
    <div className={sansTitre ? 'border-b border-filet' : 'mt-6 border-b border-filet'}>
      {questions.map((q) => (
        <div key={q.question} className="border-t border-filet py-5">
          <h3 className="text-xl leading-snug text-texte">{typo(q.question)}</h3>
          <p className="mt-2 max-w-[42rem] text-base leading-relaxed text-texte-doux">{typo(q.reponse)}</p>
        </div>
      ))}
    </div>
  );
  if (sansTitre) return liste;
  const idTitre = `titre-${id}`;
  return (
    <section id={id} aria-labelledby={idTitre} className="rule-double pt-6">
      <TitreDeSection id={idTitre} titre={titre} />
      {liste}
    </section>
  );
}
