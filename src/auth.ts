import NextAuth from "next-auth";
import Naver from "next-auth/providers/naver";
import Credentials from "next-auth/providers/credentials";
import { DEV_ACCOUNTS } from "@/lib/dev-accounts";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * 개발 환경 전용 테스트 로그인 (/dev-login 페이지에서 사용).
 * `next dev`에서만 프로바이더가 등록되며, authorize에서 한 번 더 차단하므로
 * 프로덕션 빌드에서는 어떤 경로로도 동작하지 않는다.
 */
const devLogin = Credentials({
  id: "dev-login",
  name: "테스트 계정",
  credentials: { accountId: { label: "계정 ID" } },
  authorize(credentials) {
    if (process.env.NODE_ENV !== "development") return null;
    const account = DEV_ACCOUNTS.find((a) => a.id === credentials?.accountId);
    if (!account) return null;
    // 여기서 반환한 id가 token.sub → session.user.id로 이어진다.
    return { id: account.id, name: account.name };
  },
});

/**
 * 네이버 로그인 (Auth.js v5)
 * 환경변수: AUTH_SECRET, AUTH_NAVER_ID, AUTH_NAVER_SECRET (자동 인식)
 * 네이버 개발자 센터 콜백 URL: {배포주소}/api/auth/callback/naver
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers:
    process.env.NODE_ENV === "development" ? [Naver, devLogin] : [Naver],
  callbacks: {
    async jwt({ token, profile }) {
      // 로그인 시점에만 profile이 전달된다(네이버 원본 응답).
      // Auth.js가 세션마다 랜덤 UUID를 sub로 쓰는 경우가 있어,
      // 네이버 고유 ID를 sub에 직접 고정해야 로그인해도 같은 사용자로 인식된다.
      const naverId = (profile as { response?: { id?: string } } | null)
        ?.response?.id;
      if (naverId) {
        token.sub = naverId;
        // 임원 관리(/admin) 목록에 나타나도록 최초 로그인 시 프로필 행을 만들어 둔다.
        // 이미 행이 있으면 아무것도 하지 않는다 (닉네임을 덮어쓰지 않음).
        try {
          const { error } = await supabaseAdmin()
            .from("profiles")
            .upsert(
              {
                id: naverId,
                nickname: token.name ?? "이름 없음",
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id", ignoreDuplicates: true }
            );
          // supabase-js는 throw하지 않으므로 error를 직접 확인해야 한다.
          // 실패하면 이 사용자가 임원 관리 목록에 안 나타나므로 로그는 남긴다.
          if (error) {
            console.error("로그인 프로필 자동 생성 실패:", error.message);
          }
        } catch (e) {
          // 프로필 생성 실패(환경변수 누락 등)는 로그인 자체를 막지 않는다
          console.error("로그인 프로필 자동 생성 실패:", e);
        }
      }
      return token;
    },
    session({ session, token }) {
      // token.sub = 네이버 사용자 고유 ID → 예약 소유자 판별에 사용
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
