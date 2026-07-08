import { RULES } from "./constants";

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
