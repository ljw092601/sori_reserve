// 예약 규칙 (PLAN.md 7번 항목) — 여기 숫자만 바꾸면 전체에 반영된다.
export const RULES = {
  /** 최소 예약 시간 (분) */
  MIN_MINUTES: 30,
  /** 최대 예약 시간 (분) */
  MAX_MINUTES: 240,
  /** 오늘부터 며칠 뒤까지 예약 가능한지 */
  MAX_DAYS_AHEAD: 14,
} as const;

/** 예약 폼의 빠른 시간 선택 버튼 — RULES 범위를 벗어나는 항목은 자동 제외 */
export const DURATION_OPTIONS = [30, 60, 120, 180, 240]
  .filter((min) => min >= RULES.MIN_MINUTES && min <= RULES.MAX_MINUTES)
  .map((min) => ({
    label: min % 60 === 0 ? `${min / 60}시간` : `${min}분`,
    min,
  }));

/** 팀원 세션 선택지 — 이 외에는 "직접 입력"으로 자유 입력 */
export const SESSION_PRESETS = [
  "보컬",
  "기타1",
  "기타2",
  "드럼",
  "베이스",
  "키보드",
] as const;

/** 모집 상태 표시 라벨 */
export const TEAM_STATUS_LABEL = {
  recruiting: "모집중",
  closed: "모집완료",
} as const;

/** 새 팀 색상 자동 배정 팔레트 — 사용 중이 아닌 색을 앞에서부터 고른다 */
export const TEAM_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#78716c",
];

/** 시간표 표시 범위 (시) */
export const DAY_START_HOUR = 9;
export const DAY_END_HOUR = 24;

export const TIME_ZONE = "Asia/Seoul";
