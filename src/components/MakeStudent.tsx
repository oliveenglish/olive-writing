"use client";
import { useFormState, useFormStatus } from "react-dom";
import { makeStudent, type MakeStudentState } from "@/app/actions/teacher";

type Unit = { id: string; title: string; stage: string };

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending}>{pending ? "만드는 중…" : "학생 계정 만들기"}</button>;
}

/** 쌤이 학생 아이디 · PIN을 직접 만들어 주는 칸 */
export default function MakeStudent({ classes, units, siteUrl }: { classes: { id: string; name: string }[]; units: Unit[]; siteUrl?: string }) {
  const [state, action] = useFormState<MakeStudentState, FormData>(makeStudent, undefined);
  const stages = Array.from(new Set(units.map((u) => u.stage)));
  const msg = state?.made
    ? `${state.made.name} 학생 로그인 정보\n주소: ${siteUrl || "(사이트 주소)"}\n아이디: ${state.made.username}\nPIN: ${state.made.pin}\n'학생' 탭에서 아이디와 PIN을 넣으면 돼요.`
    : "";
  return (
    <div className="card col">
      <h3 style={{ fontSize: 17 }}>학생 계정 만들기</h3>
      <form action={action} className="col" style={{ gap: 10 }}>
        <div className="grid2">
          <label className="field"><span>이름</span><input name="name" className="input" placeholder="김민지" /></label>
          <label className="field"><span>학년 (선택)</span><input name="grade" className="input" placeholder="G4 · 초5" /></label>
          <label className="field"><span>별명 (선택 · 학생 화면 위에 보여요)</span><input name="nickname" className="input" placeholder="문장 장인" /></label>
          <label className="field"><span>아이디 (영어 소문자 · 숫자)</span><input name="username" className="input en" placeholder="minji01" autoCapitalize="none" autoComplete="off" /></label>
          <label className="field"><span>PIN (숫자 4자리)</span><input name="pin" className="input" inputMode="numeric" maxLength={4} placeholder="1234" autoComplete="off" /></label>
          <label className="field"><span>반 (선택)</span>
            <select name="class_id" className="select" defaultValue="">
              <option value="">{classes.length ? "첫 번째 반" : "자동으로 '내 학생' 반"}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field"><span>시작 유닛 (선택 · 비우면 처음부터)</span>
            <select name="unit" className="select" defaultValue="">
              <option value="">처음부터</option>
              {stages.map((st) => (
                <optgroup key={st} label={st}>
                  {units.filter((u) => u.stage === st).map((u) => <option key={u.id} value={u.id}>{u.id} · {u.title}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
        <Submit />
      </form>
      {state?.error && <div className="bubble no">{state.error}</div>}
      {state?.made && (
        <div className="card tint col" style={{ gap: 6 }}>
          <b>만들었어요! 아래 내용을 학생 · 학부모에게 보내 주세요.</b>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{msg}</pre>
          <button type="button" className="btn ghost sm" onClick={() => navigator.clipboard?.writeText(msg)}>복사하기</button>
        </div>
      )}
    </div>
  );
}
