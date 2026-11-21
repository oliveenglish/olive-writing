import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { myStudents } from "@/lib/teacher";
import { signedUrl, type Proof } from "@/lib/progress";
import { kst } from "@/lib/dates";
import CheckCard, { type ProofCard } from "@/components/CheckCard";

export const dynamic = "force-dynamic";

export default async function Proofs({ searchParams }: { searchParams: { done?: string } }) {
  const me = await requireTeacher();
  const { students } = await myStudents(me.id);
  const names = new Map(students.map((s) => [s.id, s.name]));
  const done = searchParams.done === "1";
  const { data } = students.length
    ? await db()
        .from("proofs")
        .select("*")
        .in("student_id", students.map((s) => s.id))
        .eq("status", done ? "returned" : "submitted")
        .order(done ? "returned_at" : "created_at", { ascending: !done })
        .limit(done ? 40 : 100)
    : { data: [] };
  const list = (data as Proof[]) ?? [];
  const cards: ProofCard[] = await Promise.all(
    list.map(async (p) => {
      let before: ProofCard["before"] = null;
      if (p.step === 7) {
        const { data: p5 } = await db().from("proofs").select("id,photo_path,markup_path").eq("student_id", p.student_id).eq("unit_id", p.unit_id).eq("step", 5).eq("status", "returned").order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (p5) before = { id: p5.id, photo: await signedUrl(p5.photo_path), markup: await signedUrl(p5.markup_path) };
      }
      return {
        id: p.id,
        student: names.get(p.student_id) ?? "",
        unit: p.unit_id,
        step: p.step,
        when: kst(done ? p.returned_at : p.created_at).slice(5, 16).replace("T", " "),
        photo: await signedUrl(p.photo_path),
        markup: p.step === 7 ? await signedUrl(p.markup_path) : null,
        status: p.status,
        decision: p.decision,
        comment: p.comment,
        before,
      };
    })
  );
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <h1 className="title">인증 · 첨삭</h1>
        <div className="row" style={{ gap: 8 }}>
          <Link href="/teacher/proofs" className={`btn sm ${done ? "ghost" : ""}`}>기다리는 것</Link>
          <Link href="/teacher/proofs?done=1" className={`btn sm ${done ? "" : "ghost"}`}>돌려준 것</Link>
        </div>
      </div>
      {!done && (
        <div className="card tint small" style={{ lineHeight: 1.7 }}>
          <b>② 워크북 단어 학습 · ⑦ 다시 쓰기</b>는 ✓ 확인 / ↺ 다시 써 와요를 눌러요. ⑦을 ✓ 확인하면 다음 유닛이 열려요. ⑦이 또 틀렸으면 🖍️ 빨간 펜으로 첨삭해서 다시 써 오게 해요.<br />
          <b>⑤ 쌤 숙제</b>는 사진 위에 빨간 펜으로 첨삭해요. 학생 화면에 원본과 첨삭본이 나란히 보여요.
        </div>
      )}
      {cards.length ? (
        <div className="cardgrid">{cards.map((c) => <CheckCard key={c.id} c={c} />)}</div>
      ) : (
        <div className="card muted">{done ? "아직 돌려준 것이 없어요." : "기다리는 인증이 없어요. 👏"}</div>
      )}
    </>
  );
}
