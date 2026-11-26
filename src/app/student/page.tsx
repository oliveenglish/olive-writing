import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { checksOf, feedbackText, guideOf, latestProofs, signedUrl, stepStates, unitOf, unseenFeedback } from "@/lib/progress";
import { getUnit, setCount, wordsOf } from "@/lib/content";
import { SENT_ACTS, STEPS, WORD_ACTS, sentKey, wordKey, type StepState } from "@/lib/steps";
import { embedUrl, isFresh, materialsFor } from "@/lib/materials";
import { ICheck } from "@/components/Icons";
import StudentShell from "@/components/StudentShell";
import VideoDone from "@/components/VideoDone";

export const dynamic = "force-dynamic";

export default async function StudentHome() {
  const me = await requireStudent();
  const unit = unitOf(me);
  const [states, fresh, guide, checks, proofs, mats] = await Promise.all([
    stepStates(me.id, unit.id),
    unseenFeedback(me.id),
    guideOf(unit.id),
    checksOf(me.id, unit.id),
    latestProofs(me.id, unit.id),
    materialsFor(me),
  ]);
  const st = new Map(states.map((s) => [s.n, s]));
  const done = states.filter((s) => s.status === "done").length;
  const next = states.find((s) => s.status !== "done" && s.status !== "wait" && s.status !== "locked")?.n;
  const sets = setCount(unit.id);
  const totalWords = wordsOf(unit.id).length;
  const p5 = proofs.get(5);
  const [p5Photo, p5Markup] = await Promise.all([signedUrl(p5?.photo_path), signedUrl(p5?.markup_path)]);
  const video = embedUrl(guide?.video_url);
  const newMats = mats.filter(isFresh);
  const unitMats = mats.filter((m) => m.folder === unit.id);

  const href = (n: number): string | null => {
    if (n === 1) return "/student/words";
    if (n === 2 || n === 5 || n === 7) return `/student/proof/${n}`;
    if (n === 3) return "#video";
    if (n === 4) return "/student/sentences";
    if (n === 6) return p5 && p5.status === "returned" ? `/student/feedback/${p5.id}` : null;
    return null;
  };
  const chip = (s: StepState) => {
    if (s.status === "done") return <span className="chip">완료</span>;
    if (s.status === "wait") return <span className="chip gray">{s.note}</span>;
    if (s.status === "again") return <span className="chip red">다시 써요</span>;
    if (s.status === "new") return <span className="chip red">첨삭 도착</span>;
    if (s.status === "locked") return <span className="chip gray">잠김</span>;
    if (s.status === "doing") return <span className="go">이어서</span>;
    return <span className={s.n === next ? "go" : "go ghost"}>하기</span>;
  };
  const WHERE: Record<string, string> = { 앱: "w-app", 워크북: "w-book", 영상: "w-video", 첨삭: "w-fb" };
  const row = (s: StepState) => {
    const step = STEPS[s.n - 1];
    const cls = `task ${s.status === "done" ? "done" : s.status === "again" || s.status === "new" ? "again" : s.status === "locked" ? "locked" : s.n === next ? "next" : ""}`;
    const inner = (
      <>
        <span className="num">{s.status === "done" ? <ICheck /> : s.n}</span>
        <span className={`where ${WHERE[step.where]}`}>{step.where}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="tt">{step.title}{s.fresh && <span className="newdot">NEW</span>}</span>
          <span className="nn">{s.note || step.sub}</span>
        </span>
        {chip(s)}
      </>
    );
    const h = href(s.n);
    if (!h || s.status === "locked") return <div key={s.n} className={cls}>{inner}</div>;
    return <Link key={s.n} href={h} className={cls}>{inner}</Link>;
  };
  const setDone = (prefix: "w" | "s", set: number) =>
    (prefix === "w" ? WORD_ACTS : SENT_ACTS).filter((a) => checks.has(prefix === "w" ? wordKey(set, a.key) : sentKey(set, a.key))).length;

  const now = states.find((x) => x.status !== "done")?.n ?? 7;
  return (
    <StudentShell me={me} on="home" done={done} freshFiles={newMats.length}>
      <header className="shead">
        <div className="col" style={{ gap: 4 }}>
          <span className="small muted">{unit.id} · {unit.topic}</span>
          <h1>안녕, {me.nickname || me.name}! 오늘 할 과제를 확인해요</h1>
        </div>
        <span className="spill">{unit.id} · 7단계 중 {now}단계</span>
      </header>
        {fresh.length > 0 && (
          <section className="notice">
            <div className="row" style={{ gap: 8, fontWeight: 900, color: "var(--head)" }}>
              <span className="bell">🔔</span> 쌤 피드백 {fresh.length}개 도착
            </div>
            {fresh.map((p) => {
              const t = feedbackText(p);
              return (
                <Link key={p.id} href={`/student/feedback/${p.id}`} className={`fb ${t.tone}`}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="tt">{t.title}</span>
                    <span className="nn">{(getUnit(p.unit_id)?.id ?? p.unit_id)} · {STEPS[p.step - 1].title}{p.comment ? ` · 쌤: ${p.comment}` : ""}</span>
                  </span>
                  <span className="go">보기</span>
                </Link>
              );
            })}
          </section>
        )}

        {/* 공지: 공부 순서 */}
        <section className="scard col">
          <div className="row" style={{ gap: 10 }}>
            <span className="spill teal">공지</span>
            <h2 className="sh2">한 유닛은 이 순서로 공부해요</h2>
            <span className="small muted">앞 단계를 끝내야 다음 단계가 의미 있어요</span>
          </div>
          <ol className="howlist">
            {STEPS.map((s) => (
              <li key={s.n} className={WHERE[s.where]}>
                <b className="hw">{s.n} {s.where}</b>
                <b className="ht">{s.title.replace("앱 ", "").replace("워크북 ", "")}</b>
                <span className="hr">{s.rule}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* 과제 목록 */}
        <section className="scard col">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 className="sh2">과제 목록 · {unit.id}</h2>
            <span className="row" style={{ gap: 6 }}><span className="spill dark">해야 할 과제 {7 - done}</span><span className="spill line">완료 {done}</span></span>
          </div>
          <div className="tasks">{states.map(row)}</div>
          {done === 7 && <div className="bubble ok">이번 유닛 끝! 쌤이 다시 쓰기를 확인하면 다음 유닛이 열려요.</div>}
        </section>

        {/* 한 화면 학습 칸 */}
        <div className="homegrid">
          <section className="scard col">
            <div className="row" style={{ justifyContent: "space-between" }}><h2 className="sh2">① 단어 학습</h2><span className="small muted">단어 {totalWords}개</span></div>
            {Array.from({ length: sets }, (_, i) => i + 1).map((s) => (
              <div key={s} className="row" style={{ flexWrap: "nowrap" }}>
                <span className="small" style={{ width: 52, fontWeight: 800 }}>Set {s}</span>
                <div className="pbar" style={{ flex: 1 }}><span style={{ width: `${(setDone("w", s) / WORD_ACTS.length) * 100}%` }} /></div>
                <span className="small muted">{setDone("w", s)} / {WORD_ACTS.length}</span>
              </div>
            ))}
            <div className="small muted">플래시 카드 → 매칭 게임 → 단어 고르기 → 뜻 고르기</div>
            <Link href="/student/words" className="btn sm">{st.get(1)?.status === "done" ? "다시 보기" : "단어 학습하러 가기"}</Link>
          </section>

          <section id="video" className="scard col">
            <div className="row" style={{ justifyContent: "space-between" }}><h2 className="sh2">③ 영상 강의</h2>{guide?.video_title && <span className="small muted">{guide.video_title}</span>}</div>
            {video ? (
              <div className="vid"><iframe src={video} title={guide?.video_title || "영상 강의"} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen /></div>
            ) : guide?.video_url ? (
              <a href={guide.video_url} target="_blank" rel="noreferrer" className="btn ghost sm">영상 열기</a>
            ) : (
              <div className="bubble" style={{ background: "var(--soft)", color: "var(--muted)" }}>쌤이 이번 유닛 영상을 준비하고 있어요.</div>
            )}
            {guide?.video_note && <div className="small" style={{ lineHeight: 1.6 }}>{guide.video_note}</div>}
            {guide?.video_url && <VideoDone unitId={unit.id} done={st.get(3)?.status === "done"} />}
          </section>

          <section className="scard col">
            <div className="row" style={{ justifyContent: "space-between" }}><h2 className="sh2">④ 문장 연습</h2><span className="small muted">10문장씩</span></div>
            {Array.from({ length: sets }, (_, i) => i + 1).map((s) => (
              <div key={s} className="row" style={{ flexWrap: "nowrap" }}>
                <span className="small" style={{ width: 52, fontWeight: 800 }}>Set {s}</span>
                <div className="pbar" style={{ flex: 1 }}><span style={{ width: `${(setDone("s", s) / SENT_ACTS.length) * 100}%` }} /></div>
                <span className="small muted">{setDone("s", s)} / {SENT_ACTS.length}</span>
              </div>
            ))}
            <div className="small muted">듣고 쉐도잉 → 덩어리 배열</div>
            {st.get(4)?.status === "locked" ? (
              <div className="bubble no">영상 강의를 먼저 끝까지 봐요</div>
            ) : (
              <Link href="/student/sentences" className="btn sm">{st.get(4)?.status === "done" ? "다시 보기" : "문장 연습하러 가기"}</Link>
            )}
          </section>

          <section className="scard col">
            <div className="row" style={{ justifyContent: "space-between" }}><h2 className="sh2">숙제 안내</h2><span className="small muted">⑤ 숙제 · 내 글 쓰기</span></div>
            <div className="card warn" style={{ color: "var(--ink)", whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 15 }}>
              {guide?.homework || "워크북 숙제와 내 글 쓰기를 하고, 쪽마다 사진을 찍어 ⑤에 올려요.\n마감 날 밤 10시까지 올리면 쌤이 첨삭해 줘요."}
            </div>
            {unitMats.length > 0 && <Link href="/student/materials" className="small" style={{ fontWeight: 800 }}>교재 폴더에서 {unit.id} 자료 {unitMats.length}개 보기</Link>}
            <Link href="/student/proof/5" className="btn sm">⑤ 숙제 사진 올리기</Link>
          </section>

          <section className="scard col span2">
            <div className="row" style={{ justifyContent: "space-between" }}><h2 className="sh2">과제 제출 · 쌤 첨삭</h2>{p5?.status === "returned" && !p5.seen && <span className="chip red">첨삭 도착</span>}</div>
            {!p5 ? (
              <div className="small muted">⑤ 숙제 사진을 올리면 쌤이 빨간 펜으로 첨삭해요. 첨삭이 오면 여기서 내 사진과 나란히 볼 수 있어요.</div>
            ) : p5.status === "submitted" ? (
              <div className="bubble" style={{ background: "var(--soft)", color: "var(--muted)" }}>올렸어요. 쌤이 첨삭하고 있어요.</div>
            ) : (
              <>
                <div className="grid2">
                  <div className="col" style={{ gap: 4 }}>
                    <span className="small muted" style={{ fontWeight: 800 }}>내가 올린 사진</span>
                    {p5Photo && <Link href={`/view/${p5.id}`} className="photo"><img src={p5Photo} alt="내가 올린 사진" /></Link>}
                  </div>
                  <div className="col" style={{ gap: 4 }}>
                    <span className="small" style={{ color: "var(--red)", fontWeight: 800 }}>쌤 첨삭본</span>
                    {p5Photo && (
                      <Link href={`/view/${p5.id}`} className="photo" style={{ border: "2px solid var(--red)" }}>
                        <img src={p5Photo} alt="쌤 첨삭본" />
                        {p5Markup && <img className="overlay" src={p5Markup} alt="" />}
                      </Link>
                    )}
                  </div>
                </div>
                {p5.comment && <div className="card tint small" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}><b>쌤 한마디</b> · {p5.comment}</div>}
                <div className="grid2">
                  <Link href={`/student/feedback/${p5.id}`} className="btn ghost sm">⑥ 첨삭 자세히 보기</Link>
                  <Link href="/student/proof/7" className="btn sm">⑦ 다시 쓴 글 올리기</Link>
                </div>
              </>
            )}
          </section>
        </div>
    </StudentShell>
  );
}
