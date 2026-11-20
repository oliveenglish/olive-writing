import Link from "next/link";
import { headers } from "next/headers";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { buildReport } from "@/lib/report";
import { monthKey, todayKST, kst } from "@/lib/dates";
import ReportView from "@/components/ReportView";
import PrintButton from "@/components/PrintButton";
import { markReportSent, saveReport } from "@/app/actions/teacher";

export const dynamic = "force-dynamic";

export default async function Report({ params, searchParams }: { params: { id: string }; searchParams: { month?: string } }) {
  await requireTeacher();
  const month = searchParams.month || monthKey(todayKST());
  const r = await buildReport(params.id, month);
  const { data: rep } = await db().from("reports").select("*").eq("student_id", params.id).eq("month", month).maybeSingle();
  const h = headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const prev = new Date(`${month}-15`); prev.setMonth(prev.getMonth() - 1);
  return (
    <>
      <div className="row noprint" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <Link href={`/teacher/students/${params.id}`} className="small" style={{ fontWeight: 700 }}>← 학생 상세</Link>
          <h1 className="title">학부모 리포트 · {r.name}</h1>
        </div>
        <div className="tabs">
          <Link href={`?month=${prev.toISOString().slice(0, 7)}`}>지난달</Link>
          <span className="on" style={{ padding: "10px 18px", borderRadius: 12 }}>{month}</span>
        </div>
      </div>
      <div className="side">
        <ReportView r={r} month={month} comment={rep?.comment ?? null} />
        <aside className="col noprint">
          <form action={saveReport.bind(null, params.id, month)} className="card col">
            <b>쌤 한마디 ✏️</b>
            <textarea name="comment" className="textarea" style={{ fontSize: 15 }} defaultValue={rep?.comment ?? ""} placeholder="숫자 · 글 비교는 자동이에요. 한마디만 써 주세요." />
            <button className="btn sm">저장</button>
          </form>
          {rep?.token ? (
            <div className="card col">
              <b>학부모에게 보내기</b>
              <div className="small muted">아래 링크를 카카오톡으로 보내면 로그인 없이 볼 수 있어요.</div>
              <input className="input small" readOnly value={`${origin}/r/${rep.token}`} style={{ fontSize: 13 }} />
              <form action={markReportSent.bind(null, params.id, month)}><button className="btn ghost sm">{rep.sent_at ? `보냄 · ${kst(rep.sent_at).slice(5, 10)}` : "보냈다고 표시"}</button></form>
            </div>
          ) : (
            <div className="card small muted">한마디를 저장하면 학부모용 링크가 생겨요.</div>
          )}
          <PrintButton />
          <div className="small muted">오류 코드는 리포트에 나오지 않고 쉬운 말로 바뀌어요.</div>
        </aside>
      </div>
    </>
  );
}
