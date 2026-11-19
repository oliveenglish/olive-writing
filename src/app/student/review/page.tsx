import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { dueReviews, pickItemsForCodes } from "@/lib/data";
import { toPublic } from "@/lib/grading";
import StudentTop from "@/components/StudentTop";
import QuizRunner from "@/components/QuizRunner";
import { checkItem, finishReview } from "@/app/actions/student";

export const dynamic = "force-dynamic";

export default async function Review() {
  const me = await requireStudent();
  const due = await dueReviews(me.id);
  const codes = Array.from(new Set(due.map((d) => d.error_code as string)));
  const items = await pickItemsForCodes(me.id, codes, Math.min(Math.max(codes.length * 2, 5), 8));
  return (
    <>
      <StudentTop name={me.name} />
      <main className="wrap col" style={{ maxWidth: 860 }}>
        <h1 className="title">오늘의 복습</h1>
        {items.length ? (
          <QuizRunner items={items.map(toPublic)} instant check={async (id, r, _reason, attempt) => { "use server"; return checkItem(id, r, "review", undefined, attempt); }} finish={finishReview} />
        ) : (
          <div className="card col">오늘은 복습할 게 없어요! <Link href="/student" className="btn">홈으로</Link></div>
        )}
      </main>
    </>
  );
}
