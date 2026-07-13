/**
 * 개발 환경 전용 테스트 계정 목록.
 * id는 실제 네이버 ID와 절대 겹치지 않도록 "dev-" 접두사를 사용한다.
 * (예약/모집글의 created_by에 이 id가 그대로 저장되므로,
 *  운영 DB에서 dev- 접두사로 테스트 데이터를 한 번에 골라낼 수 있다.)
 */
export type DevRole = "임원진" | "부원";

export interface DevAccount {
  id: string;
  name: string;
  role: DevRole;
}

export const DEV_ACCOUNTS: DevAccount[] = [
  { id: "dev-exec-1", name: "테스트 임원1", role: "임원진" },
  { id: "dev-exec-2", name: "테스트 임원2", role: "임원진" },
  { id: "dev-member-1", name: "테스트 부원1", role: "부원" },
  { id: "dev-member-2", name: "테스트 부원2", role: "부원" },
  { id: "dev-member-3", name: "테스트 부원3", role: "부원" },
];
