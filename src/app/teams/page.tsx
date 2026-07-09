import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { TEAM_STATUS_LABEL } from "@/lib/constants";

export const dynamic = "force-dynamic";

const fmtDate = (iso: string) => {
  const d = iso.slice(0, 10);
  return `${+d.slice(5, 7)}월 ${+d.slice(8, 10)}일`;
};

function StatusBadge({ status }: { status: "recruiting" | "closed" }) {
  return (
    <span
      className={
        status === "recruiting"
          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
          : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500"
      }
    >
      {TEAM_STATUS_LABEL[status]}
    </span>
  );
}

export default async function TeamsPage() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("teams")
    .select(
      "id, name, color, status, members, content, created_by_name, created_at, comments(count)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="text-center text-sm text-zinc-500">
        모집글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
      </p>
    );
  }
  const posts = data ?? [];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">팀 모집 게시판</h1>
        <Link
          href="/teams/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          모집글 쓰기
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
          아직 모집글이 없어요. 하고 싶은 곡으로 첫 팀원을 모아보세요!
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((p) => {
            const commentCount =
              (p.comments as unknown as { count: number }[])?.[0]?.count ?? 0;
            return (
              <li key={p.id}>
                <Link
                  href={`/teams/${p.id}`}
                  className="block rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-400"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="font-semibold">🎵 {p.name}</span>
                    <StatusBadge
                      status={(p.status ?? "recruiting") as "recruiting" | "closed"}
                    />
                  </div>
                  {p.content && (
                    <p className="mb-2 line-clamp-2 whitespace-pre-line text-sm text-zinc-600">
                      {p.content}
                    </p>
                  )}
                  {p.members && (
                    <p className="text-sm text-zinc-600">👥 {p.members}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                    <span>{p.created_by_name ?? "운영진"}</span>
                    {p.created_at && <span>· {fmtDate(p.created_at)}</span>}
                    <span>· 💬 {commentCount}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
