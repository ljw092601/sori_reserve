import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "소리 동아리방 예약",
  description: "밴드 동아리방 사용 시간 예약 시스템",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
            <Link href="/" className="text-lg font-bold">
              🎸 소리 동아리방 예약
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/reserve"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
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
                  <span className="text-sm text-zinc-600">
                    {session.user.name}
                  </span>
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
                  <button className="rounded-lg bg-[#03C75A] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                    네이버 로그인
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
