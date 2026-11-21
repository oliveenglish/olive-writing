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
  const isWs = s.kind === "ws";
  const isP9 = isWs && s.page === "p9";
  const unitHub = `/student/unit/${encodeURIComponent(s.ref ?? "")}`;
  return (
    <>
      <StudentTop name={me.name} grade={me.grade} nickname={me.nickname} />
      <main className="wrap col">
        <div className="label">첨삭 도착</div>
        <h1 className="title">{s.title}</h1>
        {s.teacher_comment && (
          <div className="bubble ok"><Olly size={60} /><div><b>쌤 한마디</b><div>{s.teacher_comment}</div></div></div>
        )}
        {isWs && !isP9 ? (
          photo && <div className="card col"><div className="label">내가 올린 사진</div><div className="photo"><img src={photo} alt="" /></div></div>
        ) : (
          <Correction original={s.text_content} corrected={s.corrected_text} photoUrl={photo} markupUrl={markup} />
        )}
        {isP9 && (
          <div className="card strong col" style={{ gap: 8 }}>
            <b>✏️ 이제 워크시트 10쪽에 다시 써요</b>
            <div className="small">빨간 줄과 쌤 말을 보고 고쳐 쓴 다음 📷 사진을 올려요. 그다음 📱 확인 테스트!</div>
            <Link href={unitHub} className="btn">이번 주 할 일에서 10쪽 사진 올리기</Link>
          </div>
        )}
        {s.kind === "ws" && s.decision === "redo" && (
          <div className="card warn col" style={{ gap: 8 }}>
            <b>↺ 쌤이 다시 써 오래요</b>
            <Link href={unitHub} className="btn">다시 쓰고 사진 올리기</Link>
          </div>
        )}
        {!isWs && s.rewrite_wanted && !s.rewrite_done && <RewriteForm parentId={s.id} original={s.text_content} photoFirst={!!s.photo_path} />}
        {!isWs && s.rewrite_wanted && s.rewrite_done && <div className="card tint small">고쳐 쓴 글을 냈어요. 쌤이 확인하고 있어요.</div>}
        <Link href="/student" className="btn ghost">홈으로</Link>
      </main>
    </>
  );
}
