import { notFound, redirect } from "next/navigation";
import { currentProfile } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { signedUrl } from "@/lib/progress";
import BackButton from "@/components/BackButton";

export const dynamic = "force-dynamic";

/** 인증 사진 크게 보기: 원본 사진 위에 쌤 빨간 펜을 겹쳐서 (손가락으로 확대해서 봐요) */
export default async function View({ params, searchParams }: { params: { id: string }; searchParams: { only?: string } }) {
  const me = await currentProfile();
  if (!me) redirect("/login");
  const { data: p } = await db().from("proofs").select("student_id,photo_path,markup_path,step,unit_id").eq("id", params.id).maybeSingle();
  if (!p || (me.role === "student" && p.student_id !== me.id)) notFound();
  const [photo, markup] = await Promise.all([signedUrl(p.photo_path), searchParams.only === "photo" ? null : signedUrl(p.markup_path)]);
  return (
    <div style={{ minHeight: "100vh", background: "#1e2a0e" }}>
      <div className="row" style={{ justifyContent: "space-between", padding: "10px 12px", position: "sticky", top: 0, background: "#1e2a0e", zIndex: 2 }}>
        <BackButton />
        <span style={{ color: "#e3edcb", fontSize: 13, fontWeight: 700 }}>{markup ? "쌤 첨삭본 · 두 손가락으로 확대" : "두 손가락으로 확대"}</span>
      </div>
      {photo && (
        <div className="photo" style={{ borderRadius: 0, border: "none", maxWidth: 1000, margin: "0 auto" }}>
          <img src={photo} alt="사진" />
          {markup && <img className="overlay" src={markup} alt="쌤 첨삭" />}
        </div>
      )}
    </div>
  );
}
