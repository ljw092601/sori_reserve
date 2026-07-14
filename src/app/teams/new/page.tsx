import Link from "next/link";
import { auth, signIn } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import type { Board } from "@/lib/types";
import TeamForm from "./team-form";

export const dynamic = "force-dynamic";

export default async function NewTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const { board: boardParam } = await searchParams;
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-white p-10 text-center">
        <p className="text-zinc-600">
          모집글을 쓰려면 네이버 로그인이 필요합니다.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("naver", {
              redirectTo: boardParam
                ? `/teams/new?board=${encodeURIComponent(boardParam)}`
                : "/teams/new",
            });
          }}
        >
          <button className="rounded-lg bg-[#03C75A] px-6 py-3 font-medium text-white hover:opacity-90">
            네이버로 로그인하기
          </button>
        </form>
      </div>
    );
  }

  const { data: boards } = await supabaseAdmin()
    .from("boards")
    .select("id, name")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const boardList = (boards ?? []) as Board[];

  if (boardList.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-white p-10 text-center">
        <p className="text-zinc-600">
          아직 게시판이 없어요. 임원이 공연 게시판을 만들면 모집글을 쓸 수
          있어요.
        </p>
        <Link
          href="/teams"
          className="text-sm text-[var(--brand-text)] underline hover:opacity-80"
        >
          게시판으로 돌아가기
        </Link>
      </div>
    );
  }

  const defaultBoardId =
    boardList.find((b) => b.id === boardParam)?.id ?? boardList[0].id;

  return <TeamForm boards={boardList} defaultBoardId={defaultBoardId} />;
}
