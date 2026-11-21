import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { feedbackText, signedUrl, unitOf, type Proof } from "@/lib/progress";
import { STEPS } from "@/lib/steps";
import SubTop from "@/components/SubTop";

export const dynamic = "force-dynamic";

/** 쌤 피드백 한 건 보기 (잘했어요 · 다시 써 와요 · 빨간 펜 첨삭) — 열면 '봤어요' 처리 */
export default async function FeedbackPage({ params }: { params: { id: string } }) {
  const me = await requireStudent();
  const { data } = await db().from("proofs").select("*").eq("id", params.id).eq("student_id", me.id).maybeSingle();
  const p = data as Proof | null;
  if (!p || p.status !== "returned") notFound();
  if (!p.seen) await db().from("proofs").update({ seen: true }).eq("id", p.id);

  const [photo, markup] = await Promise.all([signedUrl(p.photo_path), signedUrl(p.markup_path)]);
  const t = feedbackText(p);
  const current = unitOf(me).id === p.unit_id;
  const color = t.tone === "ok" ? "var(--olive2)" : t.tone === "redo" ? "var(--warnink)" : "var(--red)";
  const bg = t.tone === "ok" ? "var(--tint)" : t.tone === "redo" ? "var(--warnbg)" : "var(--redbg)";

  let next: { href: string; label: string } | null = null;
  if (current && p.decision === "redo") next = { href: `/student/proof/${p.step}`, label: "다시 써서 사진 올리기" };
  else if (current && p.step === 5) next = { href: "/student/proof/7", label: "⑦ 첨삭 보고 다시 쓰러 가기" };

  return (
    <div className="app">
      <SubTop back="/student" small={`${p.unit_id} · ${STEPS[p.step - 1].title}`} title="쌤 피드백" />
      <main className="main">
        <section className="card col" style={{ background: bg, border: "none", gap: 6, textAlign: "center", padding: "22px 16px" }}>
          <div style={{ fontSize: 34 }}>{t.tone === "ok" ? "🎉" : t.tone === "redo" ? "✍️" : "🖍️"}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color }}>{t.title}</div>
        </section>

        {p.comment && (
          <section className="card col" style={{ gap: 6 }}>
            <span className="label" style={{ color: "var(--olive)" }}>쌤 한마디</span>
            <div style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{p.comment}</div>
          </section>
        )}

        {photo && (
          <>
            <Link href={`/view/${p.id}`} className="photo" style={markup ? { border: "2px solid var(--red)" } : undefined}>
              <img src={photo} alt="내가 올린 사진" />
              {markup && <img className="overlay" src={markup} alt="쌤 첨삭" />}
            </Link>
            <div className="small muted" style={{ textAlign: "center" }}>사진을 누르면 크게 볼 수 있어요</div>
          </>
        )}

        {next && <Link href={next.href} className="btn block">{next.label}</Link>}
        <Link href="/student" className={`btn ${next ? "ghost" : ""} block`}>이번 주 할 일로</Link>
      </main>
    </div>
  );
}
