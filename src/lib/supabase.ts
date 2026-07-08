import { createClient } from "@supabase/supabase-js";

/**
 * 서버 전용 Supabase 클라이언트 (service role 키 사용).
 * 절대 클라이언트 컴포넌트에서 import하지 말 것 — 키가 노출된다.
 */
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다. .env.local.example을 참고해 .env.local을 만들어주세요."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
