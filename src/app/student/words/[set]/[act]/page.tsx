import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { unitOf } from "@/lib/progress";
import { setCount, setWords, wordsOf } from "@/lib/content";
import { WORD_ACTS, type WordAct } from "@/lib/steps";
import SubTop from "@/components/SubTop";
import WordActivity from "@/components/WordActivity";

export const dynamic = "force-dynamic";

export default async function WordAct({ params }: { params: { set: string; act: string } }) {
  const me = await requireStudent();
  const unit = unitOf(me);
  const set = Number(params.set);
  const act = WORD_ACTS.find((a) => a.key === params.act);
  if (!act || !Number.isInteger(set) || set < 1 || set > setCount(unit.id)) notFound();
  const pick = (w: ReturnType<typeof wordsOf>[number]) => ({ word: w.word, pos: w.pos, meaning: w.meaning, colloc: w.colloc, example: w.example, example_ko: w.example_ko });
  return (
    <div className="app">
      <SubTop back="/student/words" close small={`${unit.id} · Set ${set}`} title={act.label} />
      <main className="main">
        <WordActivity unitId={unit.id} set={set} act={act.key as WordAct} words={setWords(unit.id, set).map(pick)} pool={wordsOf(unit.id).map(pick)} />
      </main>
    </div>
  );
}
