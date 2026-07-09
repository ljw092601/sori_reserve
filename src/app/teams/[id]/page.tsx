import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { TIME_ZONE } from "@/lib/constants";
import DeleteForm from "./delete-form";

export const dynamic = "force-dynamic";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const supabase = supabaseAdmin();

  const { data: team } = await supabase
    .from("teams")
    .select(
      "id, name, color, song, members, created_by, created_by_name, created_at"
    )
    .eq("id", id)
    .single();
  if (!team) notFound();

  // 이 팀의 다가오는 예약 (최대 5건)
  const { data: upcoming } = await supabase
    .from("reservations")
    .select("id, starts_at, ends_at, note")
    .eq("team_id", id)
    .gt("ends_at", new Date().toISOString())
    .order("starts_at")
    .limit(5);

  const isOwner =
    !!team.created_by && session?.user?.id === team.created_by;
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
      <h1 className="mb-6 text-xl font-bold">팀 상세</h1>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: team.color }}
          />
          <span className="font-semibold">{team.name}</span>
        </div>
        <dl className="flex flex-col gap-1 text-sm text-zinc-600">
          {team.song && <div>🎵 곡: {team.song}</div>}
          {team.members && (
            <div className="whitespace-pre-line">👥 팀원: {team.members}</div>
          )}
          <div className="text-xs text-zinc-400">
            작성자: {team.created_by_name ?? "운영진"}
          </div>
        </dl>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold">다가오는 예약</h2>
        {upcoming && upcoming.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm text-zinc-600">
            {upcoming.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/reservations/${r.id}`}
                  className="hover:underline"
                >
                  {fmt(r.starts_at)} ~ {fmt(r.ends_at)}
                  {r.note ? ` — ${r.note}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-400">예정된 예약이 없어요.</p>
        )}
        <Link
          href="/reserve"
          className="mt-3 inline-block text-sm font-medium text-zinc-900 underline hover:text-zinc-600"
        >
          이 팀으로 예약하러 가기 →
        </Link>
      </div>

      {session?.user ? (
        <>
          <Link
            href={`/teams/${team.id}/edit`}
            className="mt-6 block rounded-lg bg-zinc-900 p-3 text-center font-medium text-white hover:bg-zinc-700"
          >
            수정하기
          </Link>
          {isOwner ? (
            <DeleteForm teamId={team.id} teamName={team.name} />
          ) : (
            <p className="mt-3 text-center text-xs text-zinc-400">
              팀 삭제는 만든 사람만 할 수 있습니다.
            </p>
          )}
        </>
      ) : (
        <p className="mt-6 text-center text-sm text-zinc-400">
          로그인하면 팀 정보를 수정할 수 있습니다.
        </p>
      )}
    </div>
  );
}
