import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { addDays, dayStartEpoch, kstDateString, mondayOf } from "@/lib/dates";
import type { BlockRule } from "@/lib/block-rules";
import type { Reservation, Team } from "@/lib/types";
import WeekGrid from "./week-grid";

export const dynamic = "force-dynamic";

const fmtMD = (ds: string) => `${+ds.slice(5, 7)}월 ${+ds.slice(8, 10)}일`;

async function fetchWeek(fromIso: string, toIso: string): Promise<Reservation[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, team_id, category, starts_at, ends_at, title, note, created_by, created_by_name, created_at, team:teams(id, name, color)"
    )
    .gt("ends_at", fromIso)
    .lt("starts_at", toIso)
    .order("starts_at");
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    ...r,
    team: (Array.isArray(r.team) ? r.team[0] : r.team) as Team | null,
  }));
}

/** 정기 사용 금지 규칙 — 테이블이 아직 없으면(마이그레이션 전) 빈 목록으로 처리 */
async function fetchBlockRules(): Promise<BlockRule[]> {
  const { data, error } = await supabaseAdmin()
    .from("block_rules")
    .select("*")
    .order("day_of_week")
    .order("start_min");
  if (error) return [];
  return data ?? [];
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const today = kstDateString(new Date());
  // 정규식은 형식만 거른다 — 실존하지 않는 날짜는 V8에서 롤오버(2026-02-30→3/2)되거나
  // NaN(2026-13-01 → toISOString이 RangeError로 500)이 되므로, 라운드트립 비교로 걸러 오늘로 폴백
  const isRealDate = (s: string) => {
    const t = Date.parse(s + "T00:00:00Z");
    return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
  };
  const anchor = d && /^\d{4}-\d{2}-\d{2}$/.test(d) && isRealDate(d) ? d : today;
  const weekStart = mondayOf(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  let reservations: Reservation[];
  let blockRules: BlockRule[];
  try {
    [reservations, blockRules] = await Promise.all([
      fetchWeek(
        new Date(dayStartEpoch(days[0])).toISOString(),
        new Date(dayStartEpoch(addDays(weekStart, 7))).toISOString()
      ),
      fetchBlockRules(),
    ]);
  } catch (e) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h2 className="mb-2 font-semibold text-amber-800">⚙️ 설정이 필요합니다</h2>
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
      {/* 주 탐색 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-[var(--foreground)] sm:text-lg">
          {fmtMD(days[0])} ~ {fmtMD(days[6])}
        </h1>
        <nav className="flex gap-1.5 text-sm">
          <Link
            href={`/?d=${addDays(weekStart, -7)}`}
            className="rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 font-medium text-[var(--brand-text)] shadow-sm hover:bg-[var(--brand-soft)] transition-colors"
          >
            ← 이전 주
          </Link>
          <Link
            href={`/?d=${addDays(weekStart, 7)}`}
            className="rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 font-medium text-[var(--brand-text)] shadow-sm hover:bg-[var(--brand-soft)] transition-colors"
          >
            다음 주 →
          </Link>
        </nav>
      </div>

      <WeekGrid
        days={days}
        today={today}
        reservations={reservations}
        blockRules={blockRules}
      />
    </div>
  );
}
