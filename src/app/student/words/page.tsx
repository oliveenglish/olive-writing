import { requireStudent } from "@/lib/auth";
import { checksOf, unitOf } from "@/lib/progress";
import { setCount, setWords, wordsOf } from "@/lib/content";
import { WORD_ACTS, wordKey } from "@/lib/steps";
import SubTop from "@/components/SubTop";
import SetList from "@/components/SetList";

export const dynamic = "force-dynamic";

export default async function Words() {
  const me = await requireStudent();
  const unit = unitOf(me);
  const checks = await checksOf(me.id, unit.id);
  const sets = setCount(unit.id);
  const total = wordsOf(unit.id).length;
  return (
    <div className="app wide">
      <SubTop back="/student" small={`${unit.id} · ${unit.topic} · 단어 ${total}개`} title="① 앱 단어 학습" />
      <main className="main">
        <p className="small muted" style={{ margin: 0, lineHeight: 1.6 }}>10개씩 나눠서 해요. 세트마다 네 가지를 차례로 하면 끝!</p>
        <div className="sets">
        <SetList
          base="/student/words"
          sets={sets}
          acts={WORD_ACTS}
          done={(s, a) => checks.has(wordKey(s, a))}
          preview={(s) => setWords(unit.id, s).map((w) => w.word).join(" · ")}
          label={(s) => `Set ${s} · 단어 ${(s - 1) * 10 + 1}~${Math.min(s * 10, total)}`}
        />
        </div>
        <div className="card tint small" style={{ lineHeight: 1.6 }}>세트를 다 하면 체크! 그다음 워크북에 단어를 쓰고 ② 사진으로 인증해요.</div>
      </main>
    </div>
  );
}
