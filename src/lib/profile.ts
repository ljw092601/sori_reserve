import { cache } from "react";
import { supabaseAdmin } from "./supabase";

// 서버 전용 (supabaseAdmin 사용) — 클라이언트 컴포넌트에서 import 금지

/**
 * profiles 행 조회 — 닉네임과 역할을 한 쿼리로 가져온다.
 * React cache()로 감싸 같은 렌더 패스 안(레이아웃+페이지, displayName+getRole)에서는
 * 몇 번을 호출해도 쿼리가 1회만 나간다. Route Handler에서는 dedup이 보장되지
 * 않지만 그대로 동작한다.
 * 조회 실패 시 null — 호출부가 각자 fallback을 적용해 화면이 깨지지 않게 한다.
 */
export const fetchProfile = cache(
  async (
    userId: string
  ): Promise<{ nickname: string | null; role: string | null } | null> => {
    try {
      const { data } = await supabaseAdmin()
        .from("profiles")
        .select("nickname, role")
        .eq("id", userId)
        .maybeSingle();
      return data ?? null;
    } catch {
      return null;
    }
  }
);

/**
 * 표시 이름: 설정한 닉네임이 있으면 닉네임, 없으면 네이버 이름(fallback).
 */
export async function displayName(
  userId: string,
  fallback: string
): Promise<string> {
  return (await fetchProfile(userId))?.nickname ?? fallback;
}
