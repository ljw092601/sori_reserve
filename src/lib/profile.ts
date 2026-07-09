import { supabaseAdmin } from "./supabase";

// 서버 전용 (supabaseAdmin 사용) — 클라이언트 컴포넌트에서 import 금지

/**
 * 표시 이름: 설정한 닉네임이 있으면 닉네임, 없으면 네이버 이름(fallback).
 * 조회 실패 시에도 fallback을 반환해 화면이 깨지지 않게 한다.
 */
export async function displayName(
  userId: string,
  fallback: string
): Promise<string> {
  try {
    const supabase = supabaseAdmin();
    const { data } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("id", userId)
      .single();
    return data?.nickname ?? fallback;
  } catch {
    return fallback;
  }
}
