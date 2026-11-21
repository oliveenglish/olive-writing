import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { unitOf } from "@/lib/progress";
import { historyOf } from "@/lib/history";
import SubTop from "@/components/SubTop";
import HistoryList from "@/components/HistoryList";

export const dynamic = "force-dynamic";

/** 내 과제 모음: 유닛별 진행과 지난 첨삭 */
export default async function MyHistory() {
  const me = await requireStudent();
  const list = await historyOf(me.id, unitOf(me).id);
  const done = list.filter((h) => h.state === "done").length;
  return (
    <div className="app wide">
      <SubTop back="/student" small={`끝낸 유닛 ${done}개`} title="내 과제 모음" />
      <main className="main">
        <p className="small muted" style={{ margin: 0, lineHeight: 1.6 }}>지난 유닛의 첨삭도 여기서 다시 볼 수 있어요. 사진을 누르면 크게 보여요.</p>
        <HistoryList list={list} />
        <Link href="/student" className="btn ghost block">이번 주 할 일로</Link>
      </main>
    </div>
  );
}
