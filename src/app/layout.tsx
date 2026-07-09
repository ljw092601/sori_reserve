import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { displayName } from "@/lib/profile";
import "./globals.css";

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "소리터 동아리방 예약",
  description: "밴드 동아리방 사용 시간 예약 시스템",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const name = session?.user
    ? await displayName(session.user.id, session.user.name ?? "이름 없음")
    : null;

  return (
    <html lang="ko" className={`h-full antialiased ${notoSansKR.variable}`}>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        {/* ── 헤더 ── */}
        <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white/90 backdrop-blur-md shadow-sm">
          <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
            {/* 로고 */}
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 whitespace-nowrap"
            >
              <Image
                src="/logo.png"
                alt="소리 로고"
                width={30}
                height={30}
                priority
                className="rounded-lg shadow-sm"
              />
              <span className="text-lg font-bold tracking-tight text-[var(--foreground)] sm:hidden">
                소리터
              </span>
              <span className="max-sm:hidden text-lg font-bold tracking-tight text-[var(--foreground)]">
                소리터 동아리방 예약
              </span>
            </Link>

            {/* 우측 내비 */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/teams"
                className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--brand-text)] hover:bg-[var(--brand-soft)] transition-colors"
              >
                팀 모집
              </Link>
              <Link
                href="/reserve"
                className="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg active:scale-95"
                style={{ background: "var(--brand-gradient)" }}
              >
                예약하기
              </Link>

              {session?.user ? (
                <form
                  action={async () => {
                    "use server";
                    await signOut();
                  }}
                  className="flex items-center gap-2"
                >
                  <Link
                    href="/account"
                    className="max-w-20 truncate text-sm font-medium text-[var(--brand-text)] hover:underline sm:max-w-none"
                    title="계정 설정"
                  >
                    {name}
                  </Link>
                  <button className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
                    로그아웃
                  </button>
                </form>
              ) : (
                <form
                  action={async () => {
                    "use server";
                    await signIn("naver");
                  }}
                >
                  <button className="whitespace-nowrap rounded-xl bg-[#03C75A] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity sm:px-4">
                    <span className="sm:hidden">로그인</span>
                    <span className="max-sm:hidden">네이버 로그인</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </header>

        {/* ── 본문 ── */}
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
