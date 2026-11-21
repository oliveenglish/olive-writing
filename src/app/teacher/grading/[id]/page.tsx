import { kst } from "@/lib/dates";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { signedUrl, taughtCodes } from "@/lib/data";
import { aiEnabled, type AiDraft } from "@/lib/ai";
import GradingForm from "@/components/GradingForm";
import { rerunAi, returnSubmission } from "@/app/actions/teacher";
import { pageLabel } from "@/lib/plan";
import PhotoCheck from "@/components/PhotoCheck";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // AI 첨삭 기다리는 시간

export default async function GradeOne({ params }: { params: { id: string } }) {
  const me = await requireTeacher();
  const { data: s } = await db().from("submissions").select("*").eq("id", params.id).maybeSingle();
  if (!s) notFound();
  const { data: st } = await db().from("profiles").select("name,grade").eq("id", s.student_id).single();
  const [photo, markup, codes] = await Promise.all([signedUrl(s.photo_path), signedUrl(s.markup_path), taughtCodes(s.student_id)]);
  // 고쳐 쓴 글이면 몇 번째인지 (처음 글까지 거슬러 올라가요)
  let round = 1;
  for (let pid = s.parent_id as string | null; pid && round < 10; round++) {
    const { data: up } = await db().from("submissions").select("parent_id").eq("id", pid).maybeSingle();
    pid = up?.parent_id ?? null;
  }
  // 고쳐 쓰기면 원래 글 · 쌤 첨삭을 함께 보여 줘요
  const { data: parent } = s.parent_id ? await db().from("submissions").select("*").eq("id", s.parent_id).maybeSingle() : { data: null };
  const [pPhoto, pMarkup] = parent ? await Promise.all([signedUrl(parent.photo_path), signedUrl(parent.markup_path)]) : [null, null];
  void me;
  // 확인만 하는 워크시트 사진 (1~2 · 6~7 · 8 · 10쪽)
  if (s.kind === "ws" && s.page !== "p9") {
    const before = s.page === "p10" && parent?.page === "p9" ? { photo: pPhoto, markup: pMarkup } : null;
    return (
      <>
        <Link href="/teacher/grading?tab=check" className="small" style={{ fontWeight: 700 }}>← 사진 확인 목록</Link>
        <h1 className="title">{st?.name} · {s.title}</h1>
        <div style={{ maxWidth: before ? 900 : 560 }}>
          <PhotoCheck
            done={s.status === "returned"}
            c={{ id: s.id, student: st?.name ?? "", unit: s.ref ?? "", page: s.page ?? "", label: pageLabel(s.page), when: kst(s.created_at).slice(5, 16).replace("T", " "), photo, again: !!s.parent_id && s.page !== "p10", before, decision: s.decision, comment: s.teacher_comment }}
          />
        </div>
      </>
    );
  }
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <Link href="/teacher/grading" className="small" style={{ fontWeight: 700 }}>← 첨삭 목록</Link>
          <div className="label">{kst(s.created_at).slice(0, 16).replace("T", " ")} 제출</div>
          <div className="row" style={{ gap: 8, alignItems: "center", marginTop: 4 }}>
            {s.parent_id ? (
              <span style={{ fontSize: 13, fontWeight: 800, color: "#C2561A", background: "#FFF1E6", border: "1px solid #C2561A", borderRadius: 999, padding: "3px 12px" }}>🔁 고쳐 쓴 글 · {round}번째 제출</span>
            ) : (
              <span style={{ fontSize: 13, fontWeight: 800, color: "#1F3A6E", background: "#EAF0FB", border: "1px solid #1F3A6E", borderRadius: 999, padding: "3px 12px" }}>✨ 새 과제 · 처음 제출</span>
            )}
          </div>
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
        nextHref={`/teacher/grading?student=${s.student_id}`}
      />
    </>
  );
}
