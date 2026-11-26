import { requireStudent } from "@/lib/auth";
import { unitOf } from "@/lib/progress";
import { COMMON, folderName, isFresh, materialUrl, materialsFor } from "@/lib/materials";
import { getUnit } from "@/lib/content";
import SubTop from "@/components/SubTop";
import StudentNav from "@/components/StudentNav";

export const dynamic = "force-dynamic";

const kb = (n: number | null) => (!n ? "" : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

/** 교재 폴더: 쌤이 올린 워크북 · 자료 (지금 유닛 먼저) */
export default async function MaterialsPage() {
  const me = await requireStudent();
  const unit = unitOf(me);
  const mats = await materialsFor(me);
  const urls = await Promise.all(mats.map(materialUrl));
  const folders = Array.from(new Set(mats.map((m) => m.folder))).sort((a, b) => {
    const rank = (f: string) => (f === unit.id ? -1e9 : f === COMMON ? 1e9 : -(getUnit(f)?.ord ?? 0));
    return rank(a) - rank(b);
  });
  return (
    <div className="app wide">
      <SubTop back="/student" small="쌤이 올린 워크북 · 자료" title="교재 폴더" />
      <StudentNav on="folder" fresh={mats.filter(isFresh).length} />
      <main className="main">
        {!mats.length && <div className="card muted">아직 올라온 자료가 없어요.</div>}
        {folders.map((f) => (
          <section key={f} className="card col">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b style={{ fontSize: 17, color: "var(--head)" }}>{folderName(f)}</b>
              {f === unit.id && <span className="chip">지금 하는 유닛</span>}
            </div>
            <div className="col" style={{ gap: 8 }}>
              {mats.map((m, i) => ({ m, url: urls[i] })).filter(({ m }) => m.folder === f).map(({ m, url }) => (
                <a key={m.id} href={url ?? "#"} target="_blank" rel="noreferrer" className="file">
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b>{m.title}</b>{isFresh(m) && <span className="newdot">NEW</span>}
                    <span className="small muted" style={{ display: "block" }}>{kb(m.size)} · {m.created_at.slice(5, 10).replace("-", "/")} 올림</span>
                  </span>
                  <span className="go">열기</span>
                </a>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
