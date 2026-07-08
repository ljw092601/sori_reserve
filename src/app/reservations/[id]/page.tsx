import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { TIME_ZONE } from "@/lib/constants";
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
      "id, team_id, starts_at, ends_at, note, created_by, created_by_name, team:teams(id, name, color)"
    )
    .eq("id", id)
    .single();
  if (!r) notFound();

  const team = (Array.isArray(r.team) ? r.team[0] : r.team) as Team;
  const isOwner = session?.user?.id === r.created_by;
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
      <h1 className="mb-6 text-xl font-bold">예약 상세</h1>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: team?.color }}
          />
          <span className="font-semibold">{team?.name}</span>
        </div>
        <dl className="flex flex-col gap-1 text-sm text-zinc-600">
          <div>시작: {fmt(r.starts_at)}</div>
          <div>종료: {fmt(r.ends_at)}</div>
          <div>예약자: {r.created_by_name}</div>
          {r.note && <div>메모: {r.note}</div>}
        </dl>
      </div>

      {isOwner ? (
        <>
          <Link
            href={`/reservations/${r.id}/edit`}
            className="mt-6 block rounded-lg bg-zinc-900 p-3 text-center font-medium text-white hover:bg-zinc-700"
          >
            수정하기
          </Link>
          <CancelForm reservationId={r.id} />
        </>
      ) : (
        <p className="mt-6 text-center text-sm text-zinc-400">
          본인이 만든 예약만 수정/취소할 수 있습니다.
        </p>
      )}
    </div>
  );
}
