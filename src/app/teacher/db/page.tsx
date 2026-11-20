import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { allUnits } from "@/lib/data";
import DbUpload from "@/components/DbUpload";

export const dynamic = "force-dynamic";

export default async function DbPage() {
  await requireTeacher();
  const units = await allUnits();
  const { data: items } = await db().from("items").select("unit_id,activity,purpose");
  const { data: words } = await db().from("words").select("unit_id");
  const { count: codeCount } = await db().from("error_codes").select("code", { count: "exact", head: true });
  const cnt = (u: string, a: string) => (items ?? []).filter((i) => i.unit_id === u && i.activity === a && i.purpose === "연습").length;
  const extra = (u: string) => (items ?? []).filter((i) => i.unit_id === u && i.purpose !== "연습").length;
  return (
    <>
      <div>
        <div className="label">원본은 쌤 엑셀 · 여기서는 올리고 확인만</div>
        <h1 className="title">문항 DB <span className="small muted">오류 코드 {codeCount ?? 0}개</span></h1>
      </div>
      <DbUpload />
      <div className="tablebox">
        <table className="t">
          <thead><tr><th>단계 · 유닛</th><th>단어</th><th>배열</th><th>틀린 표현</th><th>한글→영어</th><th>대답</th><th>확인 테스트</th><th>복습 · 점검용</th><th>학생 화면</th></tr></thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id}>
                <td><b>{u.id} {u.title}</b> <span className="small muted">{u.stage}</span></td>
                <td>{(words ?? []).filter((w) => w.unit_id === u.id).length}</td>
                <td>{cnt(u.id, "arrange")}</td><td>{cnt(u.id, "find")}</td><td>{cnt(u.id, "ko2en")}</td><td>{cnt(u.id, "answer")}</td><td>{cnt(u.id, "test")}</td>
                <td>{extra(u.id)}</td>
                <td>{u.status === "published" ? <span className="chip">공개</span> : <span className="chip gray">준비 중 · 잠김</span>}</td>
              </tr>
            ))}
            {!units.length && <tr><td colSpan={9} className="muted">아직 문항이 없어요. 위에서 엑셀 파일을 올려 주세요.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
