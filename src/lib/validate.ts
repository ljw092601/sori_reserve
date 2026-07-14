import { RULES } from "./constants";
import type { MemberEntry } from "./types";

/**
 * 모집글 팀원 목록을 검증·정리한다.
 * - 세션/이름이 모두 빈 행은 버린다
 * - 이름만 있고 세션이 없으면 에러
 * - 이름이 비어 있으면 그 세션은 모집중으로 취급 (그대로 저장)
 */
export function parseMemberEntries(
  input: unknown
): { entries: MemberEntry[] } | { error: string } {
  if (input == null) return { entries: [] };
  if (!Array.isArray(input)) {
    return { error: "팀원 목록 형식이 올바르지 않습니다." };
  }
  if (input.length > 20) {
    return { error: "팀원은 20명까지 입력할 수 있습니다." };
  }

  const entries: MemberEntry[] = [];
  for (const item of input) {
    if (typeof item !== "object" || item === null) {
      return { error: "팀원 목록 형식이 올바르지 않습니다." };
    }
    const { session, name } = item as { session?: unknown; name?: unknown };
    if (
      (session != null && typeof session !== "string") ||
      (name != null && typeof name !== "string")
    ) {
      return { error: "팀원 목록 형식이 올바르지 않습니다." };
    }
    const s = typeof session === "string" ? session.trim() : "";
    const n = typeof name === "string" ? name.trim() : "";
    if (!s && !n) continue; // 완전히 빈 행은 무시
    if (!s) return { error: "세션을 입력하지 않은 팀원이 있습니다." };
    if (s.length > 20 || n.length > 20) {
      return { error: "세션/이름은 20자 이내로 입력해주세요." };
    }
    entries.push({ session: s, name: n });
  }
  return { entries };
}

/**
 * 예약 시간 범위를 검증한다. 문제가 있으면 사용자에게 보여줄 메시지를,
 * 통과하면 null을 반환한다. (겹침 검사는 DB exclusion constraint가 담당)
 */
export function validateRange(startsAt: Date, endsAt: Date): string | null {
  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
    return "날짜/시간 형식이 올바르지 않습니다.";
  }
  if (startsAt >= endsAt) {
    return "종료 시간은 시작 시간보다 뒤여야 합니다.";
  }

  const minutes = (endsAt.getTime() - startsAt.getTime()) / 60_000;
  if (minutes < RULES.MIN_MINUTES) {
    return `최소 ${RULES.MIN_MINUTES}분 이상 예약해야 합니다.`;
  }
  if (minutes > RULES.MAX_MINUTES) {
    return `최대 ${RULES.MAX_MINUTES / 60}시간까지 예약할 수 있습니다.`;
  }

  if (startsAt.getTime() < Date.now()) {
    return "과거 시간은 예약할 수 없습니다.";
  }
  const maxDate = Date.now() + RULES.MAX_DAYS_AHEAD * 24 * 60 * 60_000;
  if (startsAt.getTime() > maxDate) {
    return `예약은 ${RULES.MAX_DAYS_AHEAD}일 후까지만 가능합니다.`;
  }
  return null;
}

/**
 * 사용 금지 예약(임원 전용)의 시간 범위 검증.
 * 일반 예약 규칙(최소/최대 시간, 14일 제한, 과거 금지)은 적용하지 않는다 —
 * 방학 하루 종일 금지, 몇 주 뒤 행사 금지, 이미 시작된 금지의 종료 시간
 * 단축 같은 관리 작업이 본래 용도이기 때문. 형식과 순서만 확인한다.
 */
export function validateBlockRange(
  startsAt: Date,
  endsAt: Date
): string | null {
  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
    return "날짜/시간 형식이 올바르지 않습니다.";
  }
  if (startsAt >= endsAt) {
    return "종료 시간은 시작 시간보다 뒤여야 합니다.";
  }
  return null;
}

/**
 * 정기 사용 금지 규칙(요일 + 분 범위) 검증.
 * 자정을 넘는 규칙(예: 22:00~02:00)은 요일이 갈려 요일별 두 규칙으로 등록해야 한다.
 */
export function validateBlockRule(
  dayOfWeek: unknown,
  startMin: unknown,
  endMin: unknown
): string | null {
  if (
    !Number.isInteger(dayOfWeek) ||
    (dayOfWeek as number) < 0 ||
    (dayOfWeek as number) > 6
  ) {
    return "요일이 올바르지 않습니다.";
  }
  if (!Number.isInteger(startMin) || !Number.isInteger(endMin)) {
    return "시간 형식이 올바르지 않습니다.";
  }
  const s = startMin as number;
  const e = endMin as number;
  if (s < 0 || e > 1440) {
    return "시간은 00:00~24:00 범위여야 합니다.";
  }
  if (s >= e) {
    return "종료 시간은 시작 시간보다 뒤여야 합니다. (자정을 넘는 금지는 요일별로 나눠 등록해주세요)";
  }
  return null;
}
