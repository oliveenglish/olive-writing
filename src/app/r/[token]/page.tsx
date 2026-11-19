import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { buildReport } from "@/lib/report";
import ReportView from "@/components/ReportView";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

/** 학부모용 리포트 (로그인 없이 링크로) */
export default async function PublicReport({ params }: { params: { token: string } }) {
  const { data: rep } = await db().from("reports").select("*").eq("token", params.token).maybeSingle();
  if (!rep) notFound();
  const r = await buildReport(rep.student_id, rep.month);
  return (
    <main className="wrap col" style={{ maxWidth: 900 }}>
      <ReportView r={r} month={rep.month} comment={rep.comment} />
      <div className="noprint"><PrintButton /></div>
    </main>
  );
}
