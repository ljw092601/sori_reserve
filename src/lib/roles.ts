import { supabaseAdmin } from "./supabase";
import { DEV_ACCOUNTS } from "./dev-accounts";

// 서버 전용 (supabaseAdmin 사용) — 클라이언트 컴포넌트에서 import 금지

/** profiles.role 값 — 'exec'만 임원, 그 외(null 포함)는 부원 취급 */
export type Role = "exec" | "member";

/**
 * 사용자의 역할 조회.
 * 1) profiles.role에 명시된 값이 있으면 그것이 우선 — /admin의 승급/강등이 여기에 쓰인다
 * 2) 없으면 개발 환경 테스트 계정의 역할로 폴백 (DB에 행이 없는 가짜 ID이므로)
 * 조회 실패 시 'member'를 반환해 권한이 잘못 열리는 일이 없게 한다.
 */
export async function getRole(
  userId: string | null | undefined
): Promise<Role> {
  if (!userId) return "member";

  try {
    const { data } = await supabaseAdmin()
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (data?.role) return data.role === "exec" ? "exec" : "member";
  } catch {
    // 조회 실패 → 아래 폴백으로
  }

  if (process.env.NODE_ENV === "development") {
    const dev = DEV_ACCOUNTS.find((a) => a.id === userId);
    if (dev) return dev.role === "임원진" ? "exec" : "member";
  }

  return "member";
}

/** 임원 여부 판별 */
export async function isExecutive(
  userId: string | null | undefined
): Promise<boolean> {
  return (await getRole(userId)) === "exec";
}
