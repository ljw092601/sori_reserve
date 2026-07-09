/** 팀 = 팀원 모집글. name에는 곡 제목이 들어간다. */
export type Team = {
  id: string;
  /** 곡 제목 — 시간표/예약 드롭다운에 그대로 표시 */
  name: string;
  color: string;
  /** 모집 상태 */
  status?: "recruiting" | "closed";
  /** 현재 모인 팀원 (자유 입력) */
  members?: string | null;
  /** 모집 글 본문 */
  content?: string | null;
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
  team_id: string;
  starts_at: string; // ISO 8601
  ends_at: string; // ISO 8601
  note: string | null;
  /** 네이버 사용자 고유 ID — 예약자 본인만 취소 가능 */
  created_by: string;
  /** 표시용 예약자 이름 */
  created_by_name: string;
  created_at: string;
  /** 조회 시 조인으로 채워짐 */
  team?: Team;
};
