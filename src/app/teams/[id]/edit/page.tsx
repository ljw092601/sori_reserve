import { notFound } from "next/navigation";
import { auth, signIn } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import EditForm from "./edit-form";

export const dynamic = "force-dynamic";

export default async function TeamEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const supabase = supabaseAdmin();

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, song, members")
    .eq("id", id)
    .single();
  if (!team) notFound();

  if (!session?.user) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-white p-10 text-center">
        <p className="text-zinc-600">
          팀 정보를 수정하려면 네이버 로그인이 필요합니다.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("naver", { redirectTo: `/teams/${id}/edit` });
          }}
        >
          <button className="rounded-lg bg-[#03C75A] px-6 py-3 font-medium text-white hover:opacity-90">
            네이버로 로그인하기
          </button>
        </form>
      </div>
    );
  }

  return (
    <EditForm
      teamId={team.id}
      initial={{
        name: team.name,
        song: team.song ?? "",
        members: team.members ?? "",
      }}
    />
  );
}
