import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { signedUrl } from "@/lib/data";
import StudentTop from "@/components/StudentTop";
import Correction from "@/components/Correction";
import Olly from "@/components/Olly";
import RewriteForm from "@/components/RewriteForm";

export const dynamic = "force-dynamic";

export default async function Feedback({ params }: { params: { id: string } }) {
  const me = await requireStudent();
  const { data: s } = await db().from("submissions").select("*").eq("id", params.id).eq("student_id", me.id).maybeSingle();
  if (!s || s.status !== "returned") notFound();
  if (!s.seen) await db().from("submissions").update({ seen: true }).eq("id", s.id);
  const [photo, markup] = await Promise.all([signedUrl(s.photo_path), signedUrl(s.markup_path)]);
  return (
    <>
      <StudentTop name={me.name} grade={me.grade} nickname={me.nickname} />
      <main className="wrap col">
        <div className="label">첨삭 도착</div>
        <h1 className="title">{s.title}</h1>
        {s.teacher_comment && (
          <div className="bubble ok"><Olly size={60} /><div><b>쌤 한마디</b><div>{s.teacher_comment}</div></div></div>
        )}
        <Correction original={s.text_content} corrected={s.corrected_text} photoUrl={photo} markupUrl={markup} />
        {s.kind === "final" && s.decision && (
          <div className={`card ${s.decision === "pass" ? "tint" : "warn"}`}>
            {s.decision === "pass" ? "최종 점검 통과! 다음 단계가 열렸어요." : "조금만 더 연습하고 다시 써 보자. 복습 미션이 들어갔어요."}
          </div>
        )}
        {s.rewrite_wanted && !s.rewrite_done && <RewriteForm parentId={s.id} original={s.text_content} photoFirst={!!s.photo_path} />}
        {s.rewrite_wanted && s.rewrite_done && <div className="card tint small">고쳐 쓴 글을 냈어요. 쌤이 확인하고 있어요.</div>}
        <Link href="/student" className={s.rewrite_wanted && !s.rewrite_done ? "btn ghost" : "btn"}>홈으로</Link>
      </main>
    </>
  );
}
