import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { allUnits, getUnit } from "@/lib/content";
import type { Guide } from "@/lib/progress";
import GuideForm from "@/components/GuideForm";

export const dynamic = "force-dynamic";

/** 영상 강의: 유닛마다 영상 1개 + 숙제 안내 → 학생 과제 ③ · 숙제 안내 칸에 들어가요 */
export default async function VideosPage({ searchParams }: { searchParams: { stage?: string; unit?: string } }) {
  await requireTeacher();
  const units = allUnits();
  const stages = Array.from(new Set(units.map((u) => u.stage)));
  const picked = getUnit(searchParams.unit);
  const stage = picked?.stage ?? (stages.includes(searchParams.stage ?? "") ? searchParams.stage! : stages[0]);
  const inStage = units.filter((u) => u.stage === stage);
  const { data, error } = await db().from("unit_guides").select("*");
  const guides = new Map(((data as Guide[]) ?? []).map((g) => [g.unit_id, g]));
  const unit = picked ?? inStage.find((u) => !guides.get(u.id)?.video_url) ?? inStage[0];
  const g = guides.get(unit.id) ?? null;
  const withVideo = inStage.filter((u) => guides.get(u.id)?.video_url).length;
  const missingAll = units.filter((u) => !guides.get(u.id)?.video_url).length;
  return (
    <>
      <div>
        <div className="label">유닛마다 영상 1개 · 학생 과제 ③ 영상 강의에 자동으로 들어가요</div>
        <h1 className="title">영상 강의 <span className="small muted">영상 없는 유닛 {missingAll}개</span></h1>
      </div>
      {error && <div className="card warn">영상 표가 아직 없어요. Supabase → SQL Editor에서 supabase/schema.sql을 다시 실행해 주세요.</div>}
      <div className="row" style={{ gap: 6 }}>
        {stages.map((s) => (
          <Link key={s} href={`/teacher/videos?stage=${encodeURIComponent(s)}`} className={`btn sm ${s === stage ? "" : "ghost"}`}>{s}</Link>
        ))}
      </div>
      <div className="side2" style={{ alignItems: "start" }}>
        <div className="tablebox">
          <table className="t" style={{ minWidth: 0 }}>
            <thead><tr><th>유닛</th><th>영상</th><th>숙제 안내</th></tr></thead>
            <tbody>
              {inStage.map((u) => {
                const x = guides.get(u.id);
                return (
                  <tr key={u.id} style={u.id === unit.id ? { background: "var(--tint)" } : undefined}>
                    <td><Link href={`/teacher/videos?unit=${encodeURIComponent(u.id)}`} style={{ fontWeight: 800, textDecoration: "none" }}>{u.id}</Link><div className="small muted">{u.title}</div></td>
                    <td>{x?.video_url ? <span className="chip">올림{x.video_title ? ` · ${x.video_title}` : ""}</span> : <span className="chip red">영상 없음</span>}</td>
                    <td>{x?.homework ? <span className="ok">✓</span> : <span className="muted">기본 문구</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="small muted" style={{ padding: "10px 12px" }}>{stage} · {inStage.length}개 중 {withVideo}개 올림</div>
        </div>
        <div className="card col">
          <h2 style={{ fontSize: 18 }}>{unit.id} · {unit.title} <span className="small muted">{unit.topic}</span></h2>
          <GuideForm key={unit.id} unitId={unit.id} g={g} />
        </div>
      </div>
    </>
  );
}
