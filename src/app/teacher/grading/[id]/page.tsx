import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { signedUrl, taughtCodes } from "@/lib/data";
import { aiEnabled, type AiDraft } from "@/lib/ai";
import GradingForm from "@/components/GradingForm";
import { rerunAi, returnSubmission } from "@/app/actions/teacher";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // AI 첨삭 기다리는 시간

export default async function GradeOne({ params }: { params: { id: string } }) {
  const me = await requireTeacher();
  const { data: s } = await db().from("submissions").select("*").eq("id", params.id).maybeSingle();
  if (!s) notFound();
  const { data: st } = await db().from("profiles").select("name,grade").eq("id", s.student_id).single();
  const [photo, markup, codes] = await Promise.all([signedUrl(s.photo_path), signedUrl(s.markup_path), taughtCodes(s.student_id)]);
  const { data: nextOne } = await db().from("submissions").select("id").eq("status", "submitted").neq("id", s.id).order("created_at").limit(1);
  // 고쳐 쓰기면 원래 글 · 쌤 첨삭을 함께 보여 줘요
  const { data: parent } = s.parent_id ? await db().from("submissions").select("*").eq("id", s.parent_id).maybeSingle() : { data: null };
  const [pPhoto, pMarkup] = parent ? await Promise.all([signedUrl(parent.photo_path), signedUrl(parent.markup_path)]) : [null, null];
  void me;
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <Link href="/teacher/grading" className="small" style={{ fontWeight: 700 }}>← 첨삭 목록</Link>
          <div className="label">{String(s.created_at).slice(0, 16).replace("T", " ")} 제출 {s.rubric?.part1 ? `· 파트 1 문법 ${s.rubric.part1}` : ""}</div>
          <h1 className="title">{st?.name} · {s.title}</h1>
        </div>
        {aiEnabled() && (
          <form action={rerunAi.bind(null, s.id)}><button className="btn ghost sm">{s.ai_draft ? "AI 초안 다시 만들기" : "AI 초안 만들기"}</button></form>
        )}
      </div>
      {(s.rubric?.memo || s.rubric?.example) && (
        <div className="card tint col" style={{ gap: 4 }}>
          <b className="small">쌤 참고 (학생에겐 안 보여요)</b>
          {s.rubric?.memo && <div className="small">메모 · 볼 코드: {String(s.rubric.memo)}</div>}
          {s.rubric?.example && <div className="small">예시 답: <span className="en">{String(s.rubric.example)}</span></div>}
        </div>
      )}
      {parent && (
        <div className="card warn col" style={{ gap: 10 }}>
          <b>고쳐 쓰기예요 — 지난번 첨삭과 비교해 보세요</b>
          <div className="grid2">
            <div className="col">
              <div className="label">처음 쓴 글</div>
              {pPhoto && <div className="photo"><img src={pPhoto} alt="처음 쓴 글" /></div>}
              {parent.text_content && <div className="paper en small">{parent.text_content}</div>}
            </div>
            <div className="col">
              <div className="label">지난번 쌤 첨삭</div>
              {pPhoto && pMarkup && <div className="photo" style={{ position: "relative" }}><img src={pPhoto} alt="" /><img src={pMarkup} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} /></div>}
              {parent.corrected_text && <div className="paper en small">{parent.corrected_text}</div>}
              {parent.teacher_comment && <div className="small"><b>쌤 한마디:</b> {parent.teacher_comment}</div>}
              {(parent.error_codes ?? []).length > 0 && <div className="small muted">찍은 오류: {(parent.error_codes as string[]).join(" · ")}</div>}
            </div>
          </div>
        </div>
      )}
      <GradingForm
        action={returnSubmission.bind(null, s.id)}
        kind={s.kind}
        text={s.text_content}
        photoUrl={photo}
        markupUrl={markup}
        draft={(s.ai_draft as AiDraft) ?? null}
        codes={codes.map((c) => ({ code: c.code, name: c.name }))}
        initial={{ corrected: s.corrected_text, comment: s.teacher_comment, codes: s.error_codes ?? [], rubric: s.rubric ?? {}, decision: s.decision, rewrite: s.status === "returned" ? !!s.rewrite_wanted : !s.parent_id }}
        returned={s.status === "returned"}
        nextHref={nextOne?.[0] ? `/teacher/grading/${nextOne[0].id}` : "/teacher/grading"}
      />
    </>
  );
}
