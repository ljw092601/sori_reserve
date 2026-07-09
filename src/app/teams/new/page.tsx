import { auth, signIn } from "@/auth";
import TeamForm from "./team-form";

export const dynamic = "force-dynamic";

export default async function NewTeamPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-white p-10 text-center">
        <p className="text-zinc-600">팀을 만들려면 네이버 로그인이 필요합니다.</p>
        <form
          action={async () => {
            "use server";
            await signIn("naver", { redirectTo: "/teams/new" });
          }}
        >
          <button className="rounded-lg bg-[#03C75A] px-6 py-3 font-medium text-white hover:opacity-90">
            네이버로 로그인하기
          </button>
        </form>
      </div>
    );
  }

  return <TeamForm />;
}
