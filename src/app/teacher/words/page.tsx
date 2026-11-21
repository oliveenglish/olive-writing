import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { allUnits, getUnit, sourceFile, wordsOf } from "@/lib/content";

export const dynamic = "force-dynamic";

/** 단어 · 예문 엑셀: 지금 사이트에 들어간 내용 보기 + 바꾸는 방법 */
export default async function Words({ searchParams }: { searchParams: { unit?: string } }) {
  await requireTeacher();
  const units = allUnits();
  const total = units.reduce((a, u) => a + wordsOf(u.id).length, 0);
  const pick = getUnit(searchParams.unit) ?? units[0];
  const stages = Array.from(new Set(units.map((u) => u.stage)));
  return (
    <>
      <div>
        <div className="label">지금 사이트에 들어간 엑셀</div>
        <h1 className="title">단어 · 예문 <span className="small muted">유닛 {units.length}개 · 단어 {total}개</span></h1>
      </div>
      <div className="card tint small" style={{ lineHeight: 1.8 }}>
        <b>파일:</b> {sourceFile}<br />
        <b>엑셀을 고쳤을 때:</b> GitHub 저장소 → <b>data</b> 폴더 → 예전 엑셀을 지우고 고친 엑셀을 올려요 (Add file → Upload files). 1~2분 뒤 사이트가 다시 배포되면 바뀌어요.<br />
        엑셀은 지금 모양 그대로요: &lsquo;유닛별 주제&rsquo; 시트 + &lsquo;어휘 · 예문&rsquo; 시트. data 폴더에는 .xlsx 파일을 <b>한 개만</b> 둬요.
      </div>
      <div className="side2" style={{ gridTemplateColumns: "300px minmax(0, 1fr)", alignItems: "start" }}>
        <div className="card col" style={{ gap: 4, maxHeight: 640, overflow: "auto" }}>
          {stages.map((st) => (
            <div key={st} className="col" style={{ gap: 2 }}>
              <div className="label" style={{ marginTop: 8 }}>{st}</div>
              {units.filter((u) => u.stage === st).map((u) => (
                <Link key={u.id} href={`/teacher/words?unit=${encodeURIComponent(u.id)}`} className="small" style={{ padding: "6px 8px", borderRadius: 8, textDecoration: "none", fontWeight: u.id === pick.id ? 800 : 500, background: u.id === pick.id ? "var(--tint)" : undefined }}>
                  {u.id} · {u.title}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="card col">
          <h2 style={{ fontSize: 18 }}>{pick.id} · {pick.title} <span className="small muted">{pick.topic} · {pick.level}</span></h2>
          <div className="tablebox">
            <table className="t" style={{ minWidth: 640 }}>
              <thead><tr><th>#</th><th>단어 · 표현</th><th>뜻</th><th>같이 쓰는 말</th><th>예문</th></tr></thead>
              <tbody>
                {wordsOf(pick.id).map((w, k) => (
                  <tr key={k} style={k === 10 ? { borderTop: "3px solid var(--line2)" } : undefined}>
                    <td className="small muted">{w.n}</td>
                    <td><b className="en">{w.word}</b> <span className="small muted">{w.pos}</span></td>
                    <td>{w.meaning}</td>
                    <td className="small en">{w.colloc}</td>
                    <td className="small"><span className="en">{w.example}</span><div className="muted">{w.example_ko}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="small muted">1~10번이 Set 1, 11~20번이 Set 2예요.</div>
        </div>
      </div>
    </>
  );
}
