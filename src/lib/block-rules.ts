// 정기 사용 금지 규칙 — "매주 X요일 HH:mm~HH:mm은 예약 불가"
// 서버/클라이언트 공용 (supabase를 import하지 않는 순수 로직만 둘 것)

import { addDays, dayStartEpoch, kstDateString } from "./dates";

/** block_rules 테이블 한 행. 요일·분은 모두 KST 기준. */
export type BlockRule = {
  id: string;
  /** 0=일 ~ 6=토 */
  day_of_week: number;
  /** KST 자정부터의 분 (예: 18:00 = 1080) */
  start_min: number;
  end_min: number;
  note: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
};

/** 요일 라벨 — day_of_week 값(0=일)을 인덱스로 쓴다 */
export const DOW_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** KST 자정 기준 분 → "HH:mm" */
export const minToHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** "HH:mm" → KST 자정 기준 분 (형식이 아니면 NaN) */
export const hhmmToMin = (hhmm: string) => {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

/** "매주 월요일 18:00~21:00" 형태의 표시 문자열 */
export const ruleLabel = (r: Pick<BlockRule, "day_of_week" | "start_min" | "end_min">) =>
  `매주 ${DOW_LABELS[r.day_of_week]}요일 ${minToHHMM(r.start_min)}~${minToHHMM(r.end_min)}`;

/**
 * 예약 시간 범위가 규칙과 겹치는지 검사 — 겹치는 첫 규칙을 반환.
 * 범위가 KST 자정을 넘거나 여러 날에 걸쳐도 날짜별로 잘라 요일을 각각 판정한다.
 * (start < end는 호출 전에 검증돼 있다고 가정)
 */
export function findRuleConflict(
  rules: BlockRule[],
  startsAt: string | Date,
  endsAt: string | Date
): BlockRule | null {
  if (rules.length === 0) return null;
  const startMs = new Date(startsAt).getTime();
  const endMs = new Date(endsAt).getTime();
  if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) return null;

  for (
    let day = kstDateString(new Date(startMs));
    dayStartEpoch(day) < endMs;
    day = addDays(day, 1)
  ) {
    const dayStart = dayStartEpoch(day);
    // 이 날짜에 걸친 구간을 자정 기준 분으로 변환
    const sMin = Math.max(startMs - dayStart, 0) / 60_000;
    const eMin = Math.min(endMs - dayStart, 86_400_000) / 60_000;
    if (eMin <= sMin) continue;

    const dow = new Date(day + "T00:00:00Z").getUTCDay();
    const hit = rules.find(
      (r) => r.day_of_week === dow && r.start_min < eMin && r.end_min > sMin
    );
    if (hit) return hit;
  }
  return null;
}
