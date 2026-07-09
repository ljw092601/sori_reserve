export type Team = {
  id: string;
  name: string;
  color: string;
  /** 하고 싶은 곡 (팀 게시판) */
  song?: string | null;
  /** 팀원 소개 (자유 입력) */
  members?: string | null;
  /** 작성자 네이버 ID — null이면 관리자가 등록한 팀 */
  created_by?: string | null;
  /** 표시용 작성자 이름 */
  created_by_name?: string | null;
  created_at?: string;
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
