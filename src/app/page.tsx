import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { addDays, dayStartEpoch, kstDateString, mondayOf } from "@/lib/dates";
import type { Reservation, Team } from "@/lib/types";
import WeekGrid from "./week-grid";

export const dynamic = "force-dynamic";

const fmtMD = (ds: string) => `${+ds.slice(5, 7)}월 ${+ds.slice(8, 10)}일`;

async function fetchWeek(fromIso: string, toIso: string): Promise<Reservation[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, team_id, starts_at, ends_at, note, created_by, created_by_name, created_at, team:teams(id, name, color)"
    )
    .gt("ends_at", fromIso)
    .lt("starts_at", toIso)
    .order("starts_at");
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    ...r,
    team: (Array.isArray(r.team) ? r.team[0] : r.team) as Team,
  }));
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const today = kstDateString(new Date());
  const anchor = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today;
  const weekStart = mondayOf(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  let reservations: Reservation[];
  try {
    reservations = await fetchWeek(
      new Date(dayStartEpoch(days[0])).toISOString(),
      new Date(dayStartEpoch(addDays(weekStart, 7))).toISOString()
    );
  } catch (e) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="mb-2 font-semibold">⚙️ 설정이 필요합니다</h2>
        <p className="text-sm text-zinc-700">
          {process.env.NODE_ENV === "development" && e instanceof Error
            ? e.message
            : "데이터를 불러오지 못했습니다. 서버 환경변수 설정을 확인해주세요."}
        </p>
        <ol className="mt-3 list-decimal pl-5 text-sm text-zinc-700">
          <li>Supabase 프로젝트를 만들고 supabase/schema.sql을 실행하세요.</li>
          <li>.env.local.example을 복사해 .env.local을 만들고 키를 넣으세요.</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold">
          {fmtMD(days[0])} ~ {fmtMD(days[6])}
        </h1>
        <nav className="flex gap-1 text-sm">
          <Link
            href={`/?d=${addDays(weekStart, -7)}`}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100"
          >
            ← 이전 주
          </Link>
          <Link
            href={`/?d=${addDays(weekStart, 7)}`}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100"
          >
            다음 주 →
          </Link>
        </nav>
      </div>

      <WeekGrid days={days} today={today} reservations={reservations} />
    </div>
  );
}
