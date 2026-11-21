import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { latestProofs, signedUrl, unitOf } from "@/lib/progress";
import { STEPS } from "@/lib/steps";
import SubTop from "@/components/SubTop";
import ProofUpload from "@/components/ProofUpload";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const GUIDE: Record<number, string> = {
  2: "워크북에 이번 유닛 단어를 쓰고, 쓴 쪽을 사진으로 찍어 올려요. 글씨가 잘 보이게 밝은 곳에서 찍어요.",
  5: "쌤이 낸 워크북 숙제를 하고, 쪽마다 한 장씩 사진을 찍어 올려요. 쌤이 빨간 펜으로 첨삭해 줘요.",
  7: "쌤 첨삭을 보고 워크북에 다시 쓴 다음 사진을 올려요.",
};

export default async function ProofPage({ params }: { params: { step: string } }) {
  const me = await requireStudent();
  const step = Number(params.step);
  if (![2, 5, 7].includes(step)) notFound();
  const unit = unitOf(me);
  const info = STEPS[step - 1];
  const proofs = await latestProofs(me.id, unit.id);
  const mine = proofs.get(step);
  const p5 = proofs.get(5);
  const [myPhoto, p5Photo, p5Markup] = await Promise.all([signedUrl(mine?.photo_path), step === 7 ? signedUrl(p5?.photo_path) : null, step === 7 ? signedUrl(p5?.markup_path) : null]);
  // 첨삭 · 확인 결과를 봤으면 '봤어요'
  if (step === 7 && p5?.status === "returned" && !p5.seen) await db().from("proofs").update({ seen: true }).eq("id", p5.id);
  if (mine?.status === "returned" && !mine.seen) await db().from("proofs").update({ seen: true }).eq("id", mine.id);

  const locked = step === 7 && (!p5 || p5.status !== "returned");
  const canUpload = !locked && (!mine || mine.status === "submitted" || mine.decision === "redo");

  return (
    <div className="app">
      <SubTop back="/student" small={`${unit.id} · ${["", "①", "②", "③", "④", "⑤", "⑥", "⑦"][step]}`} title={info.title} />
      <main className="main">
        {step === 7 && (
          locked ? (
            <div className="card tint">⑤ 쌤 숙제를 올리고 쌤 첨삭이 오면 여기서 볼 수 있어요.</div>
          ) : (
            <>
              <div className="grid2">
                <div className="col" style={{ gap: 6 }}>
                  <span className="label">내가 쓴 글</span>
                  {p5Photo && p5 && <Link href={`/view/${p5.id}?only=photo`} className="photo"><img src={p5Photo} alt="내가 쓴 글" /></Link>}
                </div>
                <div className="col" style={{ gap: 6 }}>
                  <span className="label" style={{ color: "var(--red)" }}>쌤 첨삭</span>
                  {p5Photo && (
                    <Link href={`/view/${p5!.id}`} className="photo" style={{ border: "2px solid var(--red)" }}>
                      <img src={p5Photo} alt="" />
                      {p5Markup && <img className="overlay" src={p5Markup} alt="쌤 첨삭" />}
                    </Link>
                  )}
                </div>
              </div>
              <div className="small muted" style={{ textAlign: "center" }}>사진을 누르면 크게 볼 수 있어요</div>
              {p5?.comment && (
                <div className="card col" style={{ gap: 6 }}>
                  <span className="label" style={{ color: "var(--olive)" }}>쌤 한마디</span>
                  <div style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{p5.comment}</div>
                </div>
              )}
            </>
          )
        )}

        {!locked && (
          <section className="card col" style={step === 7 ? { background: "var(--tint)", border: "none" } : undefined}>
            <span className="label" style={{ color: "var(--olive)" }}>{step === 7 ? "워크북에 다시 쓰고 인증해요" : "숙제"}</span>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>{GUIDE[step]}</div>
          </section>
        )}

        {mine && (
          <section className="card col">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b>내가 올린 사진</b>
              <span className={`chip ${mine.decision === "redo" ? "warn" : mine.status === "submitted" ? "gray" : ""}`}>
                {mine.status === "submitted" ? (step === 5 ? "쌤이 첨삭 중" : "쌤 확인 중") : mine.decision === "redo" ? "다시 써 와요" : step === 5 ? "첨삭 완료" : "쌤 확인 ✓"}
              </span>
            </div>
            {myPhoto && mine && <Link href={`/view/${mine.id}`} className="photo" style={{ maxWidth: 260 }}><img src={myPhoto} alt="올린 사진" /></Link>}
            {mine.comment && step !== 5 && <div className="bubble no" style={mine.decision === "redo" ? undefined : { background: "var(--tint)", color: "var(--olive2)" }}>쌤: {mine.comment}</div>}
            {step === 5 && mine.status === "returned" && <Link href="/student/proof/7" className="btn block">⑦ 첨삭 보러 가기</Link>}
          </section>
        )}

        {canUpload && <ProofUpload unitId={unit.id} step={step} again={mine?.decision === "redo"} />}
        {mine?.status === "submitted" && <div className="small muted" style={{ textAlign: "center" }}>쌤이 보기 전에는 사진을 새로 올려서 바꿀 수 있어요.</div>}
        <Link href="/student" className="btn ghost block">이번 주 할 일로</Link>
      </main>
    </div>
  );
}
