import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { dbErrorResponse } from "@/lib/api-error";
import { isExecutive } from "@/lib/roles";
import { displayName } from "@/lib/profile";

/**
 * POST /api/boards — 공연별 팀 모집 게시판 만들기 (임원 전용)
 * body: { name(공연 이름) }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }
  if (!(await isExecutive(session.user.id))) {
    return NextResponse.json(
      { error: "게시판은 임원만 만들 수 있습니다." },
      { status: 403 }
    );
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json(
      { error: "게시판 이름은 필수입니다." },
      { status: 400 }
    );
  }
  if (name.length > 50) {
    return NextResponse.json(
      { error: "게시판 이름은 50자 이내로 입력해주세요." },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("boards")
    .insert({
      name,
      created_by: session.user.id,
      created_by_name: await displayName(
        session.user.id,
        session.user.name ?? "이름 없음"
      ),
    })
    .select("id")
    .single();

  if (error) {
    return dbErrorResponse("POST /api/boards", error);
  }
  return NextResponse.json({ board: data }, { status: 201 });
}
