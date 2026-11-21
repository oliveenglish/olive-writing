/**
 * 유닛 · 단어 · 예문 (GitHub data 폴더의 엑셀 → 배포할 때 src/data/units.json 으로 바뀌어요)
 * 서버에서만 읽어요. 학생 화면에는 그 유닛의 10개만 보내요.
 */
import data from "@/data/units.json";

export type Unit = { id: string; stage: string; title: string; topic: string; level: string; ord: number };
export type Word = { n: number; word: string; pos: string; meaning: string; colloc: string; example: string; example_ko: string };

const D = data as unknown as { source: string; units: Unit[]; words: Record<string, Word[]> };

export const SET_SIZE = 10;
export const sourceFile = D.source;
export const allUnits = (): Unit[] => D.units;
export const getUnit = (id: string | null | undefined): Unit | undefined => D.units.find((u) => u.id === id);
export const firstUnit = (): Unit => D.units[0];
export const nextUnit = (id: string): Unit | undefined => {
  const i = D.units.findIndex((u) => u.id === id);
  return i >= 0 ? D.units[i + 1] : undefined;
};
export const wordsOf = (unitId: string): Word[] => D.words[unitId] ?? [];
/** 10개씩 묶음 수 (단어 20개면 2) */
export const setCount = (unitId: string) => Math.max(1, Math.ceil(wordsOf(unitId).length / SET_SIZE));
/** Set n (1부터) 의 단어 10개 */
export const setWords = (unitId: string, set: number): Word[] => wordsOf(unitId).slice((set - 1) * SET_SIZE, set * SET_SIZE);
