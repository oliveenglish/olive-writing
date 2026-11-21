import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { allUnits } from "@/lib/data";
import { CardBody } from "@/components/Explain";

export const dynamic = "force-dynamic";

const ACT: Record<string, string> = { choose: "고르기", arrange: "단어 배열", find: "틀린 표현 고치기", ko2en: "한글 → 영어", test: "확인 테스트", answer: "대답 (주간 점검용)" };

/** 쌤용 유닛 보기: 단계 → 유닛 → 설명 카드 · 단어 · 문항 수 (학생 화면 그대로) */
export default async function Units({ searchParams }: { searchParams: { stage?: string; unit?: string } }) {
  await requireTeacher();
  const units = await allUnits();
  const stages = Array.from(new Set(units.map((u) => u.stage)));
  const stage = searchParams.stage && stages.includes(searchParams.stage) ? searchParams.stage : stages[0];
  const list = units.filter((u) => u.stage === stage);
  const unit = units.find((u) => u.id === searchParams.unit) ?? null;

  let detail: React.ReactNode = <div className="card muted">왼쪽에서 유닛을 누르면 학생이 보는 설명 카드가 나와요.</div>;
  if (unit) {
    const [{ data: cards }, { data: words }, { data: items }] = await Promise.all([
      db().from("unit_cards").select("ord,title,body,check_q,check_a,check_choices,audio_url").eq("unit_id", unit.id).order("ord"),
      db().from("words").select("ord,word,pos,meaning,example,example_ko").eq("unit_id", unit.id).order("ord"),
      db().from("items").select("activity").eq("unit_id", unit.id),
    ]);
    const count = new Map<string, number>();
    (items ?? []).forEach((i) => count.set(i.activity, (count.get(i.activity) ?? 0) + 1));
    detail = (
      <div className="col">
        <div className="card col" style={{ gap: 6 }}>
          <div className="label">{unit.stage} · {unit.id}</div>
          <h2 style={{ margin: 0 }}>{unit.title}</h2>
          {unit.scope && <div className="muted">{unit.scope}</div>}
          <div className="row" style={{ gap: 6 }}>
            {Object.keys(ACT).filter((a) => count.get(a)).map((a) => <span key={a} className="chip gray">{ACT[a]} {count.get(a)}</span>)}
            <span className="chip">통과 기준 {unit.pass_score}개</span>
          </div>
        </div>
        {(words ?? []).length > 0 && (
          <div className="card col" style={{ gap: 6 }}>
            <h3 style={{ fontSize: 17 }}>익힐 단어 {(words ?? []).length}개 <span className="small muted">앱 단어 학습 · Warming Up Test에 나와요</span></h3>
            <table className="t">
              <tbody>
                {(words ?? []).map((w, k) => (
                  <tr key={w.word}>
                    <td className="small muted">{k + 1}</td>
                    <td><b className="en">{w.word}</b> <span className="small muted">{w.pos}</span></td>
                    <td>{w.meaning}</td>
                    <td className="small"><span className="en">{w.example}</span>{w.example_ko && <div className="muted">{w.example_ko}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(cards ?? []).map((c, k) => (
          <div key={c.ord} className="card gcard">
            <div className="label">설명 {k + 1} / {cards!.length}{c.audio_url ? " · 쌤 음성 있음" : ""}</div>
            <h3>{c.title}</h3>
            <CardBody body={c.body} />
            {c.check_q && (
              <div className="card" style={{ marginTop: 12, background: "#F6F8EE" }}>
                <div className="label">확인 한 문제</div>
                <div><b>{c.check_q}</b></div>
                <div className="small">보기: {c.check_choices || "(직접 쓰기)"} · 정답: <b>{c.check_a}</b></div>
              </div>
            )}
          </div>
        ))}
        {!cards?.length && <div className="card muted">이 유닛은 설명 카드가 없어요.</div>}
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="label">학생이 보는 설명 카드를 미리 봐요</div>
        <h1 className="title">유닛 보기</h1>
      </div>
      <div className="row" style={{ gap: 6 }}>
        {stages.map((st) => (
          <Link key={st} href={`/teacher/units?stage=${encodeURIComponent(st)}`} className={`chip ${st === stage ? "" : "gray"}`} style={{ textDecoration: "none" }}>{st}</Link>
        ))}
      </div>
      <div className="grid2" style={{ gridTemplateColumns: "300px 1fr", alignItems: "start" }}>
        <div className="card col" style={{ gap: 4 }}>
          {list.map((u) => (
            <Link key={u.id} href={`/teacher/units?stage=${encodeURIComponent(stage)}&unit=${encodeURIComponent(u.id)}`} style={{ textDecoration: "none", padding: "8px 6px", borderRadius: 10, background: unit?.id === u.id ? "var(--tint)" : undefined }}>
              <b>{u.title}</b>
              <div className="small muted">{u.id}{u.scope ? ` · ${u.scope}` : ""}</div>
            </Link>
          ))}
          {!list.length && <span className="muted small">문항 DB를 먼저 올려 주세요.</span>}
        </div>
        {detail}
      </div>
    </>
  );
}
