import { requireStudent } from "@/lib/auth";
import { checksOf, unitOf } from "@/lib/progress";
import { setCount, setWords, wordsOf } from "@/lib/content";
import { SENT_ACTS, sentKey } from "@/lib/steps";
import SubTop from "@/components/SubTop";
import SetList from "@/components/SetList";

export const dynamic = "force-dynamic";

export default async function Sentences() {
  const me = await requireStudent();
  const unit = unitOf(me);
  const checks = await checksOf(me.id, unit.id);
  const sets = setCount(unit.id);
  const total = wordsOf(unit.id).length;
  return (
    <div className="app wide">
      <SubTop back="/student" small={`${unit.id} · ${unit.title} · 예문 ${total}개`} title="④ 앱 문장 연습" />
      <main className="main">
        <p className="small muted" style={{ margin: 0, lineHeight: 1.6 }}>단어 학습에서 본 예문으로 연습해요. 10문장씩, 먼저 듣고 따라 말한 다음 덩어리로 맞춰요.</p>
        <div className="sets">
        <SetList
          base="/student/sentences"
          sets={sets}
          acts={SENT_ACTS}
          done={(s, a) => checks.has(sentKey(s, a))}
          preview={(s) => setWords(unit.id, s)[0]?.example ? `${setWords(unit.id, s)[0].example} …` : ""}
          label={(s) => `Set ${s} · 예문 ${(s - 1) * 10 + 1}~${Math.min(s * 10, total)}`}
        />
        </div>
        <div className="card tint small" style={{ lineHeight: 1.6 }}>끝나면 쌤이 낸 워크북 숙제를 하고 ⑤ 사진으로 인증해요.</div>
      </main>
    </div>
  );
}
