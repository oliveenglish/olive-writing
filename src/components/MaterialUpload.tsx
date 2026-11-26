"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { materialUploadUrl, saveMaterial } from "@/app/actions/content";

type Opt = { value: string; label: string; group: string };

/** 교재 올리기: 파일은 브라우저에서 바로 Supabase 저장소로 (여러 개 한꺼번에) */
export default function MaterialUpload({ folders, folder, students }: { folders: Opt[]; folder: string; students: { id: string; name: string }[] }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [target, setTarget] = useState(folder);
  const [visible, setVisible] = useState("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [isNew, setIsNew] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const groups = Array.from(new Set(folders.map((f) => f.group)));

  const send = async () => {
    if (!files.length) return setMsg({ ok: false, text: "파일을 골라 주세요." });
    if (visible === "some" && !picked.length) return setMsg({ ok: false, text: "자료를 볼 학생을 골라 주세요." });
    setBusy(true);
    setMsg(null);
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    let ok = 0;
    for (const f of files) {
      const u = await materialUploadUrl(target, f.name);
      if ("error" in u) { setMsg({ ok: false, text: `${f.name}: ${u.error}` }); break; }
      const { error } = await sb.storage.from("materials").uploadToSignedUrl(u.path, u.token, f, { contentType: f.type || "application/pdf" });
      if (error) { setMsg({ ok: false, text: `${f.name}: 올리지 못했어요 (${error.message})` }); break; }
      const r = await saveMaterial({ path: u.path, title: f.name, size: f.size, folder: target, visible, studentIds: picked, isNew });
      if (r.error) { setMsg({ ok: false, text: `${f.name}: ${r.error}` }); break; }
      ok++;
    }
    setBusy(false);
    if (ok === files.length) {
      setMsg({ ok: true, text: `${ok}개 올렸어요.` });
      setFiles([]);
    }
    router.refresh();
  };

  return (
    <div className="card col">
      <h2 style={{ fontSize: 18 }}>교재 올리기</h2>
      <label className="drop">
        <input type="file" multiple accept=".pdf,image/*,.doc,.docx,.ppt,.pptx,.xlsx,.mp3" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} style={{ display: "none" }} />
        <b>{files.length ? `${files.length}개 골랐어요` : "눌러서 파일 고르기 (여러 개 가능)"}</b>
        <span className="small muted">{files.length ? files.map((f) => f.name).join(" · ") : "PDF · 사진 · 문서 · mp3"}</span>
      </label>
      <div className="side2">
        <label className="field"><span>폴더</span>
          <select className="select" value={target} onChange={(e) => setTarget(e.target.value)} style={{ fontSize: 15 }}>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {folders.filter((f) => f.group === g).map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="field"><span>보이는 학생</span>
          <select className="select" value={visible} onChange={(e) => setVisible(e.target.value)} style={{ fontSize: 15 }}>
            <option value="all">전체 학생</option>
            <option value="some">학생 고르기</option>
            <option value="teacher">쌤만 보기 (정답지 등)</option>
          </select>
        </label>
      </div>
      {visible === "some" && (
        <div className="row" style={{ gap: 6 }}>
          {students.map((s) => (
            <label key={s.id} className="chip gray" style={{ cursor: "pointer", gap: 6, padding: "8px 12px", fontSize: 14 }}>
              <input type="checkbox" checked={picked.includes(s.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, s.id] : picked.filter((x) => x !== s.id))} /> {s.name}
            </label>
          ))}
          {!students.length && <span className="small muted">학생이 아직 없어요.</span>}
        </div>
      )}
      <label className="row" style={{ gap: 8, fontSize: 15 }}><input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} style={{ width: 20, height: 20 }} />학생 화면에 &quot;NEW&quot; 표시하기 (2주 동안)</label>
      <button type="button" className="btn" disabled={busy} onClick={send}>{busy ? "올리는 중…" : "올리기"}</button>
      {msg && <div className={`bubble ${msg.ok ? "ok" : "no"}`}>{msg.text}</div>}
    </div>
  );
}
