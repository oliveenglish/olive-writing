"use client";
import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "@/app/actions/auth";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" disabled={pending} type="submit">
      {pending ? "잠깐만요…" : label}
    </button>
  );
}

export type Field = { name: string; label: string; type?: string; placeholder?: string; inputMode?: "numeric" | "text" | "email"; maxLength?: number };

export default function AuthForm({
  action,
  fields,
  submit,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  fields: Field[];
  submit: string;
}) {
  const [state, formAction] = useFormState(action, undefined);
  return (
    <form action={formAction} className="col">
      {fields.map((f) => (
        <label key={f.name} className="field">
          <span>{f.label}</span>
          <input
            className="input"
            name={f.name}
            type={f.type ?? "text"}
            placeholder={f.placeholder}
            inputMode={f.inputMode}
            maxLength={f.maxLength}
            autoCapitalize="none"
            autoComplete="off"
          />
        </label>
      ))}
      {state?.error && <div className="err">{state.error}</div>}
      <Submit label={submit} />
    </form>
  );
}
