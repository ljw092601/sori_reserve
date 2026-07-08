import NextAuth from "next-auth";
import Naver from "next-auth/providers/naver";

/**
 * 네이버 로그인 (Auth.js v5)
 * 환경변수: AUTH_SECRET, AUTH_NAVER_ID, AUTH_NAVER_SECRET (자동 인식)
 * 네이버 개발자 센터 콜백 URL: {배포주소}/api/auth/callback/naver
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Naver],
  callbacks: {
    jwt({ token, profile }) {
      // 로그인 시점에만 profile이 전달된다(네이버 원본 응답).
      // Auth.js가 세션마다 랜덤 UUID를 sub로 쓰는 경우가 있어,
      // 네이버 고유 ID를 sub에 직접 고정해야 로그인해도 같은 사용자로 인식된다.
      const naverId = (profile as { response?: { id?: string } } | null)
        ?.response?.id;
      if (naverId) token.sub = naverId;
      return token;
    },
    session({ session, token }) {
      // token.sub = 네이버 사용자 고유 ID → 예약 소유자 판별에 사용
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
