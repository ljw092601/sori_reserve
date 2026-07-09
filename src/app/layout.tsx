import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { displayName } from "@/lib/profile";
import "./globals.css";

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
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 whitespace-nowrap text-lg font-bold"
            >
              <Image
                src="/logo.png"
                alt="소리 로고"
                width={28}
                height={28}
                priority
              />
              {/* 좁은 화면에서는 짧은 이름만 표시 */}
              <span className="sm:hidden">소리터</span>
              <span className="max-sm:hidden">소리터 동아리방 예약</span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/teams"
                className="shrink-0 text-sm font-medium text-zinc-600 hover:text-zinc-900"
              >
                팀 모집
              </Link>
              <Link
                href="/reserve"
                className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 sm:px-4"
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
                    className="max-w-20 truncate text-sm text-zinc-600 hover:underline sm:max-w-none"
                    title="계정 설정"
                  >
                    {name}
                  </Link>
                  <button className="text-sm text-zinc-400 underline hover:text-zinc-600">
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
                  <button className="whitespace-nowrap rounded-lg bg-[#03C75A] px-3 py-2 text-sm font-medium text-white hover:opacity-90 sm:px-4">
                    <span className="sm:hidden">로그인</span>
                    <span className="max-sm:hidden">네이버 로그인</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
