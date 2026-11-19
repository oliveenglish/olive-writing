"use client";
import { useState } from "react";

/** 사진을 1600px 이하 JPEG로 줄여요 (저장 공간 절약) */
export async function compressImage(file: File, max = 1600): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.85));
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

export function PhotoPicker({ onPick }: { onPick: (f: File | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <div className="col">
      <label className="btn ghost sm" style={{ alignSelf: "flex-start" }}>
        📷 종이에 쓴 것 사진 올리기
        <input
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const small = await compressImage(f);
            setPreview(URL.createObjectURL(small));
            onPick(small);
          }}
        />
      </label>
      {preview && (
        <div className="row">
          <img src={preview} alt="올릴 사진" style={{ maxWidth: 240, borderRadius: 12, border: "1px solid var(--line)" }} />
          <button type="button" className="btn ghost sm" onClick={() => { setPreview(null); onPick(null); }}>사진 빼기</button>
        </div>
      )}
    </div>
  );
}
