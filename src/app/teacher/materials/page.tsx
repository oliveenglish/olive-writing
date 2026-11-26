import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { allUnits, getUnit } from "@/lib/content";
import { myStudents } from "@/lib/teacher";
import { COMMON, folderName, isFresh, materialUrl, type Material } from "@/lib/materials";
import MaterialUpload from "@/components/MaterialUpload";
import MaterialRowActions from "@/components/MaterialRowActions";

export const dynamic = "force-dynamic";

const kb = (n: number | null) => (!n ? "" : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

/** 교재 폴더: STEP · 유닛 폴더에 워크북 · 자료를 올리면 학생 '교재 폴더'에 보여요 */
export default async function MaterialsAdmin({ searchParams }: { searchParams: { f?: string } }) {
  const me = await requireTeacher();
  const units = allUnits();
  const stages = Array.from(new Set(units.map((u) => u.stage)));
  const { data, error } = await db().from("materials").select("*").eq("teacher_id", me.id).order("created_at", { ascending: false });
  const mats = (data as Material[]) ?? [];
  const counts = new Map<string, number>();
  for (const m of mats) counts.set(m.folder, (counts.get(m.folder) ?? 0) + 1);
  const { students } = await myStudents(me.id);
  const names = new Map(students.map((s) => [s.id, s.name]));
  const folder = searchParams.f === COMMON || getUnit(searchParams.f) ? searchParams.f! : mats[0]?.folder ?? units[0].id;
  const openStage = getUnit(folder)?.stage ?? null;
  const here = mats.filter((m) => m.folder === folder);
  const urls = await Promise.all(here.map(materialUrl));
  const folderOpts = [
    { value: COMMON, label: "공통 자료", group: "공통" },
    ...units.map((u) => ({ value: u.id, label: `${u.id} · ${u.title}`, group: u.stage })),
  ];
  const who = (m: Material) => (m.visible === "all" ? "전체 학생" : m.visible === "teacher" ? "쌤만 보기" : (m.student_ids ?? []).map((id) => names.get(id) ?? "?").join(", "));
  return (
    <>
      <div>
        <div className="label">STEP · 유닛 폴더에 올리면 학생 화면 '교재 폴더'와 숙제 안내 칸에 보여요</div>
        <h1 className="title">교재 폴더 <span className="small muted">파일 {mats.length}개</span></h1>
      </div>
      {error && <div className="card warn">교재 표가 아직 없어요. Supabase → SQL Editor에서 supabase/schema.sql을 다시 실행해 주세요.</div>}
      <div className="row" style={{ alignItems: "start", gap: 16 }}>
        <nav className="card col folders" aria-label="폴더">
          <Link href={`/teacher/materials?f=${COMMON}`} className={folder === COMMON ? "on" : ""}>공통 자료 {counts.get(COMMON) ? <span className="small">{counts.get(COMMON)}</span> : null}</Link>
          {stages.map((s) => {
            const inS = units.filter((u) => u.stage === s);
            const n = inS.reduce((a, u) => a + (counts.get(u.id) ?? 0), 0);
            return (
              <details key={s} open={s === openStage}>
                <summary>{s} {n > 0 && <span className="small muted">{n}</span>}</summary>
                {inS.map((u) => (
                  <Link key={u.id} href={`/teacher/materials?f=${encodeURIComponent(u.id)}`} className={folder === u.id ? "on" : ""} style={{ paddingLeft: 22 }}>
                    {u.id.replace(/^[A-Z0-9]+-/, "")} {counts.get(u.id) ? <span className="small">{counts.get(u.id)}</span> : null}
                  </Link>
                ))}
              </details>
            );
          })}
        </nav>
        <div className="col" style={{ flex: "999 1 520px", minWidth: 0 }}>
          <section className="card col">
            <h2 style={{ fontSize: 18 }}>{folderName(folder)} <span className="small muted">파일 {here.length}개</span></h2>
            {!here.length && <div className="small muted">이 폴더에는 아직 파일이 없어요. 아래에서 올려 주세요.</div>}
            {here.map((m, i) => (
              <div key={m.id} className="file" style={{ flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 200 }}>
                  <a href={urls[i] ?? "#"} target="_blank" rel="noreferrer" style={{ fontWeight: 800 }}>{m.title}</a>
                  {isFresh(m) && <span className="newdot">NEW</span>}
                  <span className="small muted" style={{ display: "block" }}>{kb(m.size)} · {m.created_at.slice(5, 10).replace("-", "/")} · {who(m)}</span>
                </span>
                <MaterialRowActions id={m.id} isNew={!!m.is_new} />
              </div>
            ))}
          </section>
          <MaterialUpload folders={folderOpts} folder={folder} students={students.map((s) => ({ id: s.id, name: s.name }))} />
        </div>
      </div>
    </>
  );
}
