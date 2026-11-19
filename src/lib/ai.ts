import Anthropic from "@anthropic-ai/sdk";

export type AiDraft = {
  transcription: string; // 사진이면 읽어 낸 글
  corrected: string; // 고친 글
  edits: { from: string; to: string; code: string | null; why: string }[];
  error_codes: string[];
  comment: string; // 학생에게 한마디 (한국어, 짧게)
};

export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

/**
 * 학생 글 1차 첨삭. 쌤이 확인하고 고쳐서 보내는 초안이에요.
 * 배운 오류 코드만 쓰고, 안 배운 문법은 고치지 않아요.
 */
export async function aiCorrect(input: {
  task: string;
  text?: string | null;
  photo?: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" } | null;
  codes: { code: string; name: string }[];
  level: string;
}): Promise<AiDraft | null> {
  if (!aiEnabled()) return null;
  const client = new Anthropic();
  const codeList = input.codes.map((c) => `${c.code}: ${c.name}`).join("\n") || "(없음)";
  const system = `너는 한국 초·중학생 영어 글쓰기 첨삭을 돕는 보조 교사야. 쌤이 최종 확인하니까 초안만 만들어.
규칙:
- 학생 수준: ${input.level}. 학생이 아직 배우지 않은 문법은 고치지 마. 아래 "배운 오류 코드"에 해당하는 실수와 철자 · 대문자 · 마침표만 고쳐.
- 고칠 때는 학생 문장을 최대한 살리고, 꼭 필요한 곳만 바꿔. 문장을 새로 쓰지 마.
- 각 수정에는 배운 오류 코드 중 맞는 코드를 붙여. 맞는 코드가 없으면 null.
- comment는 학생에게 보낼 한국어 한두 문장. 잘한 점 하나 + 고칠 점 하나. 코드 번호는 쓰지 마.
- 반드시 JSON 하나만 출력: {"transcription": "...", "corrected": "...", "edits": [{"from": "...", "to": "...", "code": "BE-01", "why": "..."}], "error_codes": ["..."], "comment": "..."}
- 사진이면 transcription에 학생이 쓴 그대로(틀린 것도 그대로) 옮겨 적어. 글이면 transcription은 원문 그대로.

배운 오류 코드:
${codeList}`;
  const content: Anthropic.Messages.ContentBlockParam[] = [];
  if (input.photo) {
    content.push({ type: "image", source: { type: "base64", media_type: input.photo.mediaType, data: input.photo.base64 } });
  }
  content.push({
    type: "text",
    text: `과제: ${input.task}\n\n학생 글:\n${input.text?.trim() || "(사진 참고)"}`,
  });
  try {
    const res = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content }],
    });
    const txt = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const json = txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1);
    const d = JSON.parse(json) as AiDraft;
    d.error_codes = Array.from(new Set((d.error_codes ?? []).filter((c) => input.codes.some((k) => k.code === c))));
    return d;
  } catch (e) {
    console.error("AI 첨삭 실패", e);
    return null;
  }
}
