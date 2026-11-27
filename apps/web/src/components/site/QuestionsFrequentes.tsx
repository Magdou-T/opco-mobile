import { TitreDeSection } from '@/components/site/TitreDeSection';
import type { QuestionReponse } from '@/lib/donnees-structurees';
import { typo } from '@/lib/format';

/**
 * Questions fréquentes d'une page, toutes dépliées : chaque réponse est lisible sans clic, par le lecteur comme par les
 * moteurs et les assistants qui citent un passage. Les données structurées (`noeudFaq`) reprennent exactement ces mots :
 * la page passe le même tableau aux deux. Une question est un `h3` (le sommaire des titres la montre), sa réponse un
 * paragraphe ; pas de liste de définitions, qui n'admet pas de titre dans `dt`.
 */
export function QuestionsFrequentes({
  questions,
  id = 'questions',
  titre = 'Questions fréquentes',
}: {
  questions: readonly QuestionReponse[];
  id?: string;
  titre?: string;
}) {
  const idTitre = `titre-${id}`;
  return (
    <section id={id} aria-labelledby={idTitre} className="rule-double pt-6">
      <TitreDeSection id={idTitre} titre={titre} />
      <div className="mt-6 divide-y divide-filet overflow-clip rounded-carte border border-filet bg-white shadow-douce">
        {questions.map((q) => (
          <div key={q.question} className="px-5 py-5 sm:px-6">
            <h3 className="text-lg leading-snug font-semibold text-texte">{typo(q.question)}</h3>
            <p className="mt-2 max-w-[40rem] text-base leading-relaxed text-texte-doux">{typo(q.reponse)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
