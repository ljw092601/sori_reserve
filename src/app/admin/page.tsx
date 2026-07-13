import Link from "next/link";
import { auth, signIn } from "@/auth";
import { isExecutive } from "@/lib/roles";
import BlockForm from "./block-form";
import MembersSection from "./members-section";

export const dynamic = "force-dynamic";

/**
 * 임원 전용 기능 페이지.
 * 지금은 사용 금지 시간 등록만 있고, 이후 임원 기능이 생기면 여기에 추가한다.
 * (페이지 접근은 안내로 막고, 실제 권한 검증은 API에서 한 번 더 한다)
 */
export default async function AdminPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-[var(--border)] bg-white p-10 text-center shadow-md">
        <p className="text-zinc-600">임원 전용 페이지입니다. 로그인해주세요.</p>
        <form
          action={async () => {
            "use server";
            await signIn("naver", { redirectTo: "/admin" });
          }}
        >
          <button className="rounded-xl bg-[#03C75A] px-6 py-3 font-semibold text-white shadow-md hover:opacity-90 transition-opacity">
            네이버로 로그인하기
          </button>
        </form>
      </div>
    );
  }

  if (!(await isExecutive(session.user.id))) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-[var(--border)] bg-white p-10 text-center shadow-md">
        <p className="font-semibold text-[var(--foreground)]">
          임원만 접근할 수 있는 페이지예요.
        </p>
        <p className="text-sm text-zinc-500">
          임원인데 접근이 안 되면 운영진에게 문의해주세요.
        </p>
        <Link
          href="/"
          className="text-sm text-[var(--brand-text)] underline hover:opacity-80"
        >
          시간표로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="mb-1 text-xl font-bold text-[var(--foreground)]">
        임원 전용
      </h1>
      <p className="mb-6 text-sm text-zinc-500">
        동아리방을 예약할 수 없게 막을 시간을 등록해요. (청소, 행사, 방학 등)
      </p>
      <div className="flex flex-col gap-6">
        <BlockForm />
        <MembersSection />
      </div>
    </div>
  );
}
