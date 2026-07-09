import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import type { Team } from "@/lib/types";

export const dynamic = "force-dynamic";

const fmtDate = (iso: string) => {
  const d = iso.slice(0, 10);
  return `${+d.slice(5, 7)}월 ${+d.slice(8, 10)}일`;
};

export default async function TeamsPage() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("teams")
    .select(
      "id, name, color, song, members, created_by, created_by_name, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="text-center text-sm text-zinc-500">
        팀 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
      </p>
    );
  }
  const teams = (data ?? []) as Team[];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">팀 게시판</h1>
        <Link
          href="/teams/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          팀 만들기
        </Link>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
          아직 등록된 팀이 없어요. 첫 팀을 만들어보세요!
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {teams.map((t) => (
            <li key={t.id}>
              <Link
                href={`/teams/${t.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-400"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="font-semibold">{t.name}</span>
                  {t.created_at && (
                    <span className="ml-auto text-xs text-zinc-400">
                      {fmtDate(t.created_at)}
                    </span>
                  )}
                </div>
                <dl className="flex flex-col gap-1 text-sm text-zinc-600">
                  {t.song && <div>🎵 {t.song}</div>}
                  {t.members && <div>👥 {t.members}</div>}
                  {t.created_by_name && (
                    <div className="text-xs text-zinc-400">
                      작성자: {t.created_by_name}
                    </div>
                  )}
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
