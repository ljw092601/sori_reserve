import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { TIME_ZONE } from "@/lib/constants";
import { kstDateString } from "@/lib/dates";
import EditForm from "./edit-form";

export const dynamic = "force-dynamic";

const kstTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ko-KR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export default async function ReservationEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const supabase = supabaseAdmin();

  const { data: r } = await supabase
    .from("reservations")
    .select("id, team_id, starts_at, ends_at, note, created_by")
    .eq("id", id)
    .single();
  if (!r) notFound();

  if (session?.user?.id !== r.created_by) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-white p-10 text-center">
        <p className="text-zinc-600">본인이 만든 예약만 수정할 수 있습니다.</p>
        <Link
          href={`/reservations/${id}`}
          className="text-sm text-zinc-900 underline"
        >
          예약 상세로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <EditForm
      reservationId={r.id}
      initial={{
        teamId: r.team_id,
        date: kstDateString(new Date(r.starts_at)),
        start: kstTime(r.starts_at),
        end: kstTime(r.ends_at),
        note: r.note ?? "",
      }}
    />
  );
}
