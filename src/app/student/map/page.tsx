import { requireStudent } from "@/lib/auth";
import { unitOf } from "@/lib/progress";
import { positionOf } from "@/lib/materials";
import SubTop from "@/components/SubTop";
import StudentNav from "@/components/StudentNav";

export const dynamic = "force-dynamic";

/** 내 위치: 전체 STEP 중 어디, 이 STEP의 몇 번째 유닛 */
export default async function MapPage() {
  const me = await requireStudent();
  const unit = unitOf(me);
  const pos = positionOf(unit);
  return (
    <div className="app wide">
      <SubTop back="/student" small={`${unit.stage} · ${pos.stageNo} / ${pos.stageTotal}단계`} title="내 위치 · STEP 지도" />
      <StudentNav on="map" />
      <main className="main">
        <section className="card col">
          <b style={{ fontSize: 17, color: "var(--head)" }}>전체 단계</b>
          <div className="stagegrid">
            {pos.stages.map((s) => (
              <div key={s.name} className={`stage ${s.state}`}>
                <b>{s.name}</b>
                <span>{s.state === "done" ? "완료" : s.state === "now" ? "지금 여기" : `${s.count} 유닛`}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card col">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b style={{ fontSize: 17, color: "var(--head)" }}>{unit.stage} 유닛</b>
            <span className="small muted">Unit {pos.unitNo} / {pos.unitTotal} 하는 중</span>
          </div>
          <div className="unitlist">
            {pos.inStage.map((u, i) => {
              const state = i < pos.unitNo - 1 ? "done" : i === pos.unitNo - 1 ? "now" : "left";
              return (
                <div key={u.id} className={`unitrow ${state}`}>
                  <span className="un">{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b>{u.id} · {u.title}</b>
                    <span className="small muted"> · {u.topic}</span>
                  </span>
                  <span className="small" style={{ fontWeight: 800 }}>{state === "done" ? "완료" : state === "now" ? "지금 여기" : ""}</span>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
