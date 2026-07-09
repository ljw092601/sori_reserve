import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { TEAM_STATUS_LABEL, TIME_ZONE } from "@/lib/constants";
import type { TeamComment } from "@/lib/types";
import DeleteForm from "./delete-form";
import CommentForm from "./comment-form";
import CommentDeleteButton from "./comment-delete-button";

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
      "id, name, color, status, members, content, created_by, created_by_name, created_at"
    )
    .eq("id", id)
    .single();
  if (!team) notFound();

  const [{ data: comments }, { data: upcoming }] = await Promise.all([
    supabase
      .from("comments")
      .select("id, team_id, content, created_by, created_by_name, created_at")
      .eq("team_id", id)
      .order("created_at"),
    supabase
      .from("reservations")
      .select("id, starts_at, ends_at, note")
      .eq("team_id", id)
      .gt("ends_at", new Date().toISOString())
      .order("starts_at")
      .limit(5),
  ]);

  const status = (team.status ?? "recruiting") as "recruiting" | "closed";
  const isOwner = !!team.created_by && session?.user?.id === team.created_by;
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
      <h1 className="mb-6 text-xl font-bold">팀원 모집</h1>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: team.color }}
          />
          <span className="font-semibold">🎵 {team.name}</span>
          <span
            className={
              status === "recruiting"
                ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500"
            }
          >
            {TEAM_STATUS_LABEL[status]}
          </span>
        </div>
        {team.content && (
          <p className="mb-3 whitespace-pre-line text-sm text-zinc-700">
            {team.content}
          </p>
        )}
        <dl className="flex flex-col gap-1 text-sm text-zinc-600">
          {team.members && <div>👥 현재 팀원: {team.members}</div>}
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

      {/* 댓글 */}
      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold">
          댓글 {comments?.length ?? 0}
        </h2>
        {comments && comments.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {(comments as TeamComment[]).map((c) => (
              <li
                key={c.id}
                className="border-b border-zinc-100 pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="font-medium text-zinc-600">
                    {c.created_by_name}
                  </span>
                  <span>{fmt(c.created_at)}</span>
                  {session?.user?.id === c.created_by && (
                    <CommentDeleteButton commentId={c.id} />
                  )}
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-zinc-700">
                  {c.content}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-400">
            첫 댓글로 지원해보세요! (예: 드럼 지원합니다)
          </p>
        )}

        {session?.user ? (
          <CommentForm teamId={team.id} />
        ) : (
          <p className="mt-4 text-xs text-zinc-400">
            댓글을 쓰려면 네이버 로그인이 필요합니다.
          </p>
        )}
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
              모집글 삭제는 작성자만 할 수 있습니다.
            </p>
          )}
        </>
      ) : (
        <p className="mt-6 text-center text-sm text-zinc-400">
          로그인하면 모집글을 수정할 수 있습니다.
        </p>
      )}
    </div>
  );
}
