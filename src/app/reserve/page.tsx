import { auth, signIn } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminBlockTeam } from "@/lib/constants";
import type { Team } from "@/lib/types";
import ReserveForm from "./reserve-form";

export const dynamic = "force-dynamic";

/** 예약 폼에서 고를 수 있는 팀 = 모집완료된 팀 (사용 금지 팀은 임원 전용이라 숨김) */
async function fetchClosedTeams(): Promise<Team[]> {
  const { data, error } = await supabaseAdmin()
    .from("teams")
    .select("id, name, color, created_by_name")
    .eq("status", "closed")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).filter((t) => !isAdminBlockTeam(t.name));
}

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

  let teams: Team[];
  try {
    teams = await fetchClosedTeams();
  } catch {
    return (
      <p className="text-center text-sm text-zinc-500">
        팀 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
      </p>
    );
  }

  return <ReserveForm teams={teams} />;
}
