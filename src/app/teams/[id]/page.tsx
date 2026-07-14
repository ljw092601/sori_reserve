import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { TEAM_STATUS_LABEL, TIME_ZONE } from "@/lib/constants";
import type { MemberEntry, TeamComment } from "@/lib/types";
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
      "id, board_id, name, color, status, members, content, created_by, created_by_name, created_at, boards(name, deleted_at)"
    )
    .eq("id", id)
    .single();
  if (!team) notFound();

  // FK 조인 — 게시판 도입 전 글이나 관리용 팀은 null일 수 있다
  const board = team.boards as unknown as {
    name: string;
    deleted_at: string | null;
  } | null;
  // 삭제 대기 게시판의 글은 숨긴다 — 유예기간 중 댓글 등을 새로 받으면 purge 때 함께 사라진다
  if (board?.deleted_at) notFound();
  const backHref = team.board_id ? `/teams?board=${team.board_id}` : "/teams";

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
  const members = (team.members ?? []) as MemberEntry[];
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
      <Link
        href={backHref}
        className="mb-2 inline-block text-sm text-zinc-500 hover:text-[var(--brand-text)] hover:underline"
      >
        ← {board?.name ?? "팀 모집 게시판"}
      </Link>
      <h1 className="mb-6 text-xl font-bold text-[var(--foreground)]">팀원 모집</h1>

      {/* 팀 정보 카드 */}
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span
            className="h-4 w-4 shrink-0 rounded-full shadow-sm ring-2 ring-white"
            style={{ backgroundColor: team.color }}
          />
          <span className="font-bold text-[var(--foreground)]">🎵 {team.name}</span>
          <span
            className={
              status === "recruiting"
                ? "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
                : "rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-500"
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
        {members.length > 0 && (
          <div className="mb-3">
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-zinc-400">
              팀원
            </h3>
            <ul className="flex flex-col gap-1 text-sm">
              {members.map((m, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-zinc-500">{m.session}</span>
                  {m.name ? (
                    <span className="text-zinc-700">{m.name}</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      모집중
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-zinc-400">
          작성자: {team.created_by_name ?? "운영진"}
        </p>
      </div>

      {/* 다가오는 예약 */}
      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-[var(--foreground)]">다가오는 예약</h2>
        {upcoming && upcoming.length > 0 ? (
          <ul className="flex flex-col gap-1.5 text-sm text-zinc-600">
            {upcoming.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/reservations/${r.id}`}
                  className="hover:text-[var(--brand-text)] hover:underline"
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
          className="mt-3 inline-block text-sm font-semibold text-[var(--brand-text)] hover:underline"
        >
          이 팀으로 예약하러 가기 →
        </Link>
      </div>

      {/* 댓글 */}
      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-[var(--foreground)]">
          댓글 {comments?.length ?? 0}
        </h2>
        {comments && comments.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {(comments as TeamComment[]).map((c) => (
              <li
                key={c.id}
                className="border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-600">
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

      {/* 수정/삭제 */}
      {session?.user ? (
        <>
          <Link
            href={`/teams/${team.id}/edit`}
            className="mt-6 block rounded-xl p-3 text-center font-semibold text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.99]"
            style={{ background: "var(--brand-gradient)" }}
          >
            수정하기
          </Link>
          {isOwner ? (
            <DeleteForm teamId={team.id} teamName={team.name} backHref={backHref} />
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
