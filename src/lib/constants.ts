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

/** 예약 목적 카테고리 — DB에는 키(value)를 저장하고 화면에는 라벨을 표시한다 */
export const RESERVATION_CATEGORIES = [
  { value: "ensemble", label: "합주" },
  { value: "personal", label: "개인연습" },
  { value: "etc", label: "기타" },
] as const;

export type ReservationCategory =
  (typeof RESERVATION_CATEGORIES)[number]["value"];

export const isReservationCategory = (
  v: unknown
): v is ReservationCategory =>
  RESERVATION_CATEGORIES.some((c) => c.value === v);

export const CATEGORY_LABEL = Object.fromEntries(
  RESERVATION_CATEGORIES.map((c) => [c.value, c.label])
) as Record<ReservationCategory, string>;

/**
 * 예약 제목 — 합주는 팀명, 기타는 입력받은 제목, 개인연습은 예약자 이름.
 * (개인연습 제목은 저장하지 않고 created_by_name을 그대로 쓴다 —
 *  닉네임 변경 시 created_by_name이 일괄 갱신되므로 항상 최신 이름이 표시된다.
 *  title 컬럼 도입 전의 기타 예약도 이름으로 폴백된다)
 */
export const reservationTitle = (r: {
  title?: string | null;
  created_by_name: string;
  team?: { name: string } | null;
}) => r.team?.name ?? r.title ?? r.created_by_name;

/** 팀이 없는 예약(개인연습/기타)의 시간표 블록 색 — 합주는 팀 색을 그대로 쓴다 */
export const CATEGORY_COLORS: Record<ReservationCategory, string> = {
  ensemble: "#7c3aed", // 팀 정보가 없을 때의 폴백
  personal: "#14b8a6",
  etc: "#78716c",
};

/** 모집글 곡 링크 최대 길이 — 폼 maxLength와 서버 검증이 함께 쓴다 */
export const SONG_URL_MAX = 300;

/** 팀원 세션 선택지 — 이 외에는 "직접 입력"으로 자유 입력 */
export const SESSION_PRESETS = [
  "보컬",
  "기타1",
  "기타2",
  "드럼",
  "베이스",
  "키보드",
  "키보드2",
] as const;

/**
 * 관리용 팀 판별 — 이름에 "사용금지"(공백 무관)가 들어가면 예약 차단용 팀.
 * 특정 날짜를 단건으로 막는 용도. (매주 반복되는 금지는 block_rules 테이블이 담당)
 * 팀 모집 게시판과 일반 예약 폼에서 숨기고, 등록은 임원 전용 페이지(/admin)에서만 한다.
 * 예약 API도 이 판별로 임원 여부를 강제한다.
 */
export const isAdminBlockTeam = (name: string) =>
  name.replace(/\s+/g, "").includes("사용금지");

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
