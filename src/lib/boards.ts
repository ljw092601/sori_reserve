import { supabaseAdmin } from "./supabase";
import { BOARD_DELETE_GRACE_HOURS } from "./constants";

// 서버 전용 (supabaseAdmin 사용) — 클라이언트 컴포넌트에서 import 금지

/**
 * 유예기간이 지난 삭제 대기 게시판을 영구 삭제한다 (lazy purge).
 * 서버리스에는 타이머가 없으므로 /teams 방문·게시판 API 호출 시점에 실행한다.
 * 게시판의 모집글·댓글·예약은 FK cascade로 함께 지워진다.
 * 실패해도 다음 호출에서 다시 시도되므로 조용히 넘어간다.
 */
export async function purgeExpiredBoards() {
  const cutoff = new Date(
    Date.now() - BOARD_DELETE_GRACE_HOURS * 60 * 60 * 1000
  ).toISOString();
  try {
    await supabaseAdmin().from("boards").delete().lt("deleted_at", cutoff);
  } catch {
    // 다음 방문 때 재시도
  }
}
