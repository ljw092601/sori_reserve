import type { ReservationCategory } from "./constants";

/** 팀원 한 명 — name이 빈 문자열이면 그 세션은 모집중 */
export type MemberEntry = {
  /** 세션 (보컬, 기타, 베이스, 드럼, 키보드 등) */
  session: string;
  /** 이름 — 비우면 모집중인 세션으로 표시 */
  name: string;
};

/** 팀 = 팀원 모집글. name에는 곡 제목이 들어간다. */
export type Team = {
  id: string;
  /** 곡 제목 — 시간표/예약 드롭다운에 그대로 표시 */
  name: string;
  color: string;
  /** 모집 상태 */
  status?: "recruiting" | "closed";
  /** 팀원 목록 (세션/이름) */
  members?: MemberEntry[];
  /** 모집 글 본문 */
  content?: string | null;
  /** 곡 링크 (유튜브 등, 선택) — 저장 전 http(s) URL인지 검증한다 */
  song_url?: string | null;
  /** 작성자 네이버 ID — null이면 관리자가 등록한 팀 */
  created_by?: string | null;
  /** 표시용 작성자 이름 */
  created_by_name?: string | null;
  created_at?: string;
};

/** 모집글 댓글 */
export type TeamComment = {
  id: string;
  team_id: string;
  content: string;
  /** 작성자 네이버 ID — 본인만 삭제 가능 */
  created_by: string;
  created_by_name: string;
  created_at: string;
};

export type Reservation = {
  id: string;
  /** 합주 예약만 팀을 가진다 — 개인연습/기타는 null */
  team_id: string | null;
  /** 예약 목적 (합주/개인연습/기타) */
  category: ReservationCategory;
  starts_at: string; // ISO 8601
  ends_at: string; // ISO 8601
  /** 기타(etc) 예약만 저장 — 합주는 팀명, 개인연습은 예약자 이름이 제목이 된다 */
  title?: string | null;
  note: string | null;
  /** 매주 반복 예약 묶음 ID — 단건 예약은 null */
  series_id?: string | null;
  /** 네이버 사용자 고유 ID — 예약자 본인만 취소 가능 */
  created_by: string;
  /** 표시용 예약자 이름 */
  created_by_name: string;
  created_at: string;
  /** 조회 시 조인으로 채워짐 — 팀 없는 예약(개인연습/기타)은 null */
  team?: Team | null;
};
