import { auth, signIn } from "@/auth";
import ReserveForm from "./reserve-form";

export const dynamic = "force-dynamic";

export default async function ReservePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-[var(--border)] bg-white p-10 text-center shadow-md">
        <p className="text-zinc-600">
          예약하려면 네이버 로그인이 필요합니다.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("naver", { redirectTo: "/reserve" });
          }}
        >
          <button className="rounded-xl bg-[#03C75A] px-6 py-3 font-semibold text-white shadow-md hover:opacity-90 transition-opacity">
            네이버로 로그인하기
          </button>
        </form>
      </div>
    );
  }

  return <ReserveForm />;
}
