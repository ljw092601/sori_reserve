import { auth, signIn } from "@/auth";
import { displayName } from "@/lib/profile";
import AccountForm from "./account-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-[var(--border)] bg-white p-10 text-center shadow-md">
        <p className="text-zinc-600">
          계정 설정을 보려면 네이버 로그인이 필요합니다.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("naver", { redirectTo: "/account" });
          }}
        >
          <button className="rounded-xl bg-[#03C75A] px-6 py-3 font-semibold text-white shadow-md hover:opacity-90 transition-opacity">
            네이버로 로그인하기
          </button>
        </form>
      </div>
    );
  }

  const naverName = session.user.name ?? "이름 없음";
  const current = await displayName(session.user.id, naverName);

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="mb-6 text-xl font-bold text-[var(--foreground)]">계정 설정</h1>

      <div className="mb-4 rounded-2xl border border-[var(--border)] bg-white p-5 text-sm text-zinc-600 shadow-sm">
        <div>네이버 이름: {naverName}</div>
        <div className="mt-1">
          현재 표시 이름:{" "}
          <span className="font-semibold text-[var(--foreground)]">{current}</span>
        </div>
      </div>

      <AccountForm currentNickname={current} />
    </div>
  );
}
