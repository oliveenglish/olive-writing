import { requireTeacher } from "@/lib/auth";
import { pendingCount } from "@/lib/teacher";
import { logout } from "@/app/actions/auth";
import TeacherNav from "@/components/TeacherNav";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const me = await requireTeacher();
  const pending = await pendingCount(me.id);
  return (
    <div className="tshell">
      <nav className="tnav noprint" aria-label="쌤 메뉴">
        <div className="b">브릿지 라이팅<small>{me.name} · 쌤 화면</small></div>
        <TeacherNav pending={pending} />
        <form action={logout} style={{ marginTop: "auto" }}><button className="btn ghost sm" style={{ width: "100%" }}>로그아웃</button></form>
      </nav>
      <main className="tmain">{children}</main>
    </div>
  );
}
