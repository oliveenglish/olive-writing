import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { signedUrl, type Proof } from "@/lib/progress";
import { kst } from "@/lib/dates";
import MarkupForm from "@/components/MarkupForm";
import CheckCard from "@/components/CheckCard";

export const dynamic = "force-dynamic";

export default async function ProofOne({ params, searchParams }: { params: { id: string }; searchParams: { pen?: string } }) {
  await requireTeacher();
  const { data } = await db().from("proofs").select("*").eq("id", params.id).maybeSingle();
  const p = data as Proof | null;
  if (!p) notFound();
  const { data: st } = await db().from("profiles").select("name").eq("id", p.student_id).maybeSingle();
  const [photo, markup] = await Promise.all([signedUrl(p.photo_path), signedUrl(p.markup_path)]);
  return (
    <>
      <div>
        <Link href="/teacher/proofs" className="small" style={{ fontWeight: 700 }}>← 인증 · 첨삭 목록</Link>
        <div className="label">{kst(p.created_at).slice(0, 16).replace("T", " ")} 제출</div>
        <h1 className="title">{st?.name} · {p.unit_id} · {p.step === 5 ? "⑤ 숙제 · 내 글 쓰기 첨삭" : p.step === 2 ? "② 워크북 단어 학습" : "⑦ 다시 쓰기"}</h1>
      </div>
      {(p.step === 5 || (p.step === 7 && searchParams.pen)) && photo ? (
        <MarkupForm proofId={p.id} photoUrl={photo} oldMarkup={markup} oldComment={p.comment} redo={p.step === 7} />
      ) : (
        <div style={{ maxWidth: 520 }}>
          <CheckCard c={{ id: p.id, student: st?.name ?? "", unit: p.unit_id, step: p.step, when: kst(p.created_at).slice(5, 16).replace("T", " "), photo, markup, status: p.status, decision: p.decision, comment: p.comment }} />
        </div>
      )}
    </>
  );
}
