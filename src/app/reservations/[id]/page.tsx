import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminBlockTeam, TIME_ZONE } from "@/lib/constants";
import { isExecutive } from "@/lib/roles";
import type { Team } from "@/lib/types";
import CancelForm from "./cancel-form";

export const dynamic = "force-dynamic";

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const supabase = supabaseAdmin();

  const { data: r } = await supabase
    .from("reservations")
    .select(
      "id, team_id, starts_at, ends_at, note, series_id, created_by, created_by_name, team:teams(id, name, color)"
    )
    .eq("id", id)
    .single();
  if (!r) notFound();

  const team = (Array.isArray(r.team) ? r.team[0] : r.team) as Team;
  const isOwner = session?.user?.id === r.created_by;
  // 사용 금지 예약은 임원 전용으로 다같이 관리한다 (만든 사람이라도 임원이 아니면 불가)
  const isBlock = isAdminBlockTeam(team?.name ?? "");
  const canManage = isBlock
    ? await isExecutive(session?.user?.id)
    : isOwner;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", {
      timeZone: TIME_ZONE,
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="mb-6 text-xl font-bold text-[var(--foreground)]">예약 상세</h1>

      <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        {/* 팀 헤더 */}
        <div className="mb-4 flex items-center gap-2">
          <span
            className="h-4 w-4 rounded-full shadow-sm ring-2 ring-white"
            style={{ backgroundColor: team?.color }}
          />
          <span className="font-bold text-[var(--foreground)]">{team?.name}</span>
          {r.series_id && (
            <span className="ml-auto rounded-full bg-[var(--brand-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--brand-text)]">
              🔁 반복 예약
            </span>
          )}
        </div>

        <dl className="flex flex-col gap-2 text-sm text-zinc-600">
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 font-medium text-zinc-400">시작</dt>
            <dd>{fmt(r.starts_at)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 font-medium text-zinc-400">종료</dt>
            <dd>{fmt(r.ends_at)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 font-medium text-zinc-400">예약자</dt>
            <dd>{r.created_by_name}</dd>
          </div>
          {r.note && (
            <div className="flex gap-2">
              <dt className="w-14 shrink-0 font-medium text-zinc-400">메모</dt>
              <dd>{r.note}</dd>
            </div>
          )}
        </dl>
      </div>

      {canManage ? (
        <>
          <Link
            href={`/reservations/${r.id}/edit`}
            className="mt-6 block rounded-xl p-3 text-center font-semibold text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.99]"
            style={{ background: "var(--brand-gradient)" }}
          >
            수정하기
          </Link>
          <CancelForm reservationId={r.id} isSeries={!!r.series_id} />
        </>
      ) : (
        <p className="mt-6 text-center text-sm text-zinc-400">
          {isBlock
            ? "사용 금지 예약은 임원만 수정/취소할 수 있습니다."
            : "본인이 만든 예약만 수정/취소할 수 있습니다."}
        </p>
      )}
    </div>
  );
}
