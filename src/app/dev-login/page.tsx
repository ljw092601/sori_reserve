import { notFound } from "next/navigation";
import { signIn } from "@/auth";
import { DEV_ACCOUNTS, type DevRole } from "@/lib/dev-accounts";

export const dynamic = "force-dynamic";

/**
 * 개발 환경 전용 테스트 로그인 페이지.
 * `next dev`에서만 접근 가능하며 프로덕션에서는 404를 반환한다.
 */
export default function DevLoginPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const roles: DevRole[] = ["임원진", "부원"];

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl border border-[var(--border)] bg-white p-8 shadow-md">
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">
          테스트 계정 로그인
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          개발 환경에서만 보이는 페이지입니다. 계정을 누르면 바로 로그인됩니다.
        </p>
      </div>

      {roles.map((role) => (
        <section key={role}>
          <h2 className="mb-2 text-sm font-semibold text-zinc-600">{role}</h2>
          <div className="flex flex-col gap-2">
            {DEV_ACCOUNTS.filter((a) => a.role === role).map((account) => (
              <form
                key={account.id}
                action={async () => {
                  "use server";
                  await signIn("dev-login", {
                    accountId: account.id,
                    redirectTo: "/",
                  });
                }}
              >
                <button className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-left text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--brand-soft)]">
                  {account.name}
                  <span className="ml-2 text-xs text-zinc-400">
                    {account.id}
                  </span>
                </button>
              </form>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
