import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { unitOf } from "@/lib/progress";
import { setCount, setWords } from "@/lib/content";
import { SENT_ACTS, type SentAct } from "@/lib/steps";
import SubTop from "@/components/SubTop";
import SentenceActivity from "@/components/SentenceActivity";

export const dynamic = "force-dynamic";

export default async function SentenceAct({ params }: { params: { set: string; act: string } }) {
  const me = await requireStudent();
  const unit = unitOf(me);
  const set = Number(params.set);
  const act = SENT_ACTS.find((a) => a.key === params.act);
  if (!act || !Number.isInteger(set) || set < 1 || set > setCount(unit.id)) notFound();
  return (
    <div className="app">
      <SubTop back="/student/sentences" close small={`${unit.id} · Set ${set}`} title={act.label} />
      <main className="main">
        <SentenceActivity unitId={unit.id} set={set} act={act.key as SentAct} items={setWords(unit.id, set).map((w) => ({ word: w.word, example: w.example, example_ko: w.example_ko }))} />
      </main>
    </div>
  );
}
