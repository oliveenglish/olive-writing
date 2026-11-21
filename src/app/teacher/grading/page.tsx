import { kst } from "@/lib/dates";
import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { myStudents } from "@/lib/teacher";
import { aiEnabled } from "@/lib/ai";
import { signedUrl } from "@/lib/data";
import { pageLabel } from "@/lib/plan";
import PhotoCheck, { type CheckCardData } from "@/components/PhotoCheck";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { ws: "워크시트", weekly: "주간 점검", task: "쌤 과제", unit_answer: "유닛 대답", final: "최종 점검", hand: "손글씨" };
/** 확인만 하는 워크시트 사진 (9쪽만 빨간 펜 첨삭) */
const isCheck = (x: { kind: string; page?: string | null }) => x.kind === "ws" && x.page !== "p9";

export default async function Grading({ searchParams }: { searchParams: { done?: string; student?: string; tab?: string } }) {
  const me = await requireTeacher();
  const { students } = await myStudents(me.id);
  const names = new Map(students.map((s) => [s.id, s.name]));
  const done = searchParams.done === "1";
  const tab = done ? "done" : searchParams.tab === "check" ? "check" : "correct";
  const { data: subs } = students.length
    ? await db()
        .from("submissions")
        .select("id,student_id,kind,page,ref,title,created_at,ai_draft,photo_path,returned_at,parent_id,decision,teacher_comment")
        .in("student_id", students.map((s) => s.id))
        .eq("status", done ? "returned" : "submitted")
        .order(done ? "returned_at" : "created_at", { ascending: !done })
        .limit(150)
    : { data: [] };
  const all = subs ?? [];
  const nCorrect = done ? 0 : all.filter((x) => !isCheck(x)).length;
  const nCheck = done ? 0 : all.filter(isCheck).length;
  const list = tab === "check" ? all.filter(isCheck) : tab === "correct" ? all.filter((x) => !isCheck(x)) : all;
  // 학생별로 골라서 봐요
  const count = new Map<string, number>();
  list.forEach((x) => count.set(x.student_id, (count.get(x.student_id) ?? 0) + 1));
  const pick = searchParams.student ?? "";
  const shown = list.filter((x) => !pick || x.student_id === pick);
  const base = tab === "check" ? "/teacher/grading?tab=check" : tab === "done" ? "/teacher/grading?done=1" : "/teacher/grading?";
  const q = (st: string) => `${base}${st ? `${base.endsWith("?") ? "" : "&"}student=${st}` : ""}`;

  let cards: CheckCardData[] = [];
  if (tab === "check") {
    cards = await Promise.all(
      shown.map(async (x) => {
        let before: CheckCardData["before"] = null;
        if (x.page === "p10" && x.parent_id) {
          const { data: p } = await db().from("submissions").select("photo_path,markup_path,page").eq("id", x.parent_id).maybeSingle();
          if (p?.page === "p9") before = { photo: await signedUrl(p.photo_path), markup: await signedUrl(p.markup_path) };
        }
        return {
          id: x.id,
          student: names.get(x.student_id) ?? "",
          unit: x.ref ?? "",
          page: x.page ?? "",
          label: pageLabel(x.page),
          when: kst(x.created_at).slice(5, 16).replace("T", " "),
          photo: await signedUrl(x.photo_path),
          again: !!x.parent_id && x.page !== "p10",
          before,
        };
      })
    );
  }

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <h1 className="title">첨삭 · 채점</h1>
        <div className="tabs">
          <Link href="/teacher/grading" className={tab === "correct" ? "on" : ""}>✏️ 첨삭 대기 {tab !== "done" ? nCorrect : ""}</Link>
          <Link href="/teacher/grading?tab=check" className={tab === "check" ? "on" : ""}>📷 사진 확인 {tab !== "done" ? nCheck : ""}</Link>
          <Link href="/teacher/grading?done=1" className={tab === "done" ? "on" : ""}>돌려준 것</Link>
        </div>
      </div>
      {tab === "correct" && (
        <div className="card row" style={{ justifyContent: "space-between" }}>
          <div>
            <b>빨간 펜 첨삭</b>{" "}
            <span className="small muted">
              워크시트 9쪽 내 글 · 주간 점검 · 쌤 과제 글. {aiEnabled() ? "9쪽 사진은 AI가 먼저 초안을 만들어요. 쌤이 확인하고 고쳐서 보내요." : "AI 초안은 꺼져 있어요. (ANTHROPIC_API_KEY 설정 필요)"}
            </span>
          </div>
        </div>
      )}
      {tab === "check" && (
        <div className="card tint small">워크시트 1~2 · 6~7 · 8 · 10쪽 사진이에요. <b>✓ 확인</b>을 누르면 학생 체크리스트에 &lsquo;쌤 확인 ✓&rsquo;가 뜨고, <b>↺ 다시 써 와요</b>를 누르면 학생 홈에 알림이 가요. 10쪽은 9쪽 첨삭본과 나란히 보여요.</div>
      )}
      <div className="row" style={{ gap: 6 }}>
        <span className="small muted" style={{ fontWeight: 700 }}>학생 고르기</span>
        <Link href={q("")} className={`chip ${pick ? "gray" : ""}`} style={{ textDecoration: "none" }}>전체 {list.length}</Link>
        {students.filter((st) => count.get(st.id)).map((st) => (
          <Link key={st.id} href={q(st.id)} className={`chip ${pick === st.id ? "" : "gray"}`} style={{ textDecoration: "none" }}>{st.name} {count.get(st.id)}</Link>
        ))}
      </div>
      {tab === "check" ? (
        cards.length ? (
          <div className="checkgrid">{cards.map((c) => <PhotoCheck key={c.id} c={c} />)}</div>
        ) : (
          <div className="card muted">확인할 사진이 없어요. 👏</div>
        )
      ) : (
        <div className="tablebox">
          <table className="t">
            <thead><tr><th>학생</th><th>종류</th><th>제목</th><th>{done ? "돌려준 때" : "제출"}</th><th></th></tr></thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id}>
                  <td><b>{names.get(s.student_id)}</b></td>
                  <td>
                    <span className="chip">{s.kind === "ws" ? `✏️ ${pageLabel(s.page)}` : KIND[s.kind] ?? s.kind}</span>{" "}
                    {isCheck(s) ? (
                      <span className={`chip ${s.decision === "redo" ? "red" : "gray"}`}>{s.decision === "redo" ? "↺ 다시 써 와요" : "✓ 확인"}</span>
                    ) : s.parent_id ? (
                      <span className="chip" style={{ background: "#FFF1E6", color: "#C2561A", borderColor: "#C2561A" }}>🔁 고쳐 쓴 글</span>
                    ) : null}{" "}
                    {s.ai_draft && <span className="chip gray">AI 초안</span>}
                  </td>
                  <td>{s.title}</td>
                  <td className="small">{kst(done ? s.returned_at : s.created_at).slice(5, 16).replace("T", " ")}</td>
                  <td><Link href={`/teacher/grading/${s.id}`} className="btn sm">{done ? "보기" : "첨삭하기"}</Link></td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={5} className="muted">{done ? "아직 없어요." : "기다리는 첨삭이 없어요. 👏"}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
