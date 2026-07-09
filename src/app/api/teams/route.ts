import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { TEAM_COLORS } from "@/lib/constants";

const TEAM_SELECT =
  "id, name, color, status, members, content, created_by, created_by_name, created_at";

/** GET /api/teams — 모집글(팀) 목록 (로그인 불필요) */
export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("teams")
    .select(TEAM_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ teams: data });
}

/**
 * POST /api/teams — 팀원 모집글 쓰기 (네이버 로그인 필요)
 * body: { name(곡 제목), members?, content? }
 * 색상은 사용 중이 아닌 팔레트 색을 자동 배정. 상태는 '모집중'으로 시작.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  let body: { name?: string; members?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json(
      { error: "곡 제목은 필수입니다." },
      { status: 400 }
    );
  }
  if (name.length > 50) {
    return NextResponse.json(
      { error: "곡 제목은 50자 이내로 입력해주세요." },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();

  const { data: existing } = await supabase.from("teams").select("color");
  const used = new Set((existing ?? []).map((t) => t.color));
  const color =
    TEAM_COLORS.find((c) => !used.has(c)) ??
    TEAM_COLORS[(existing?.length ?? 0) % TEAM_COLORS.length];

  const { data, error } = await supabase
    .from("teams")
    .insert({
      name,
      color,
      members: body.members?.trim() || null,
      content: body.content?.trim() || null,
      created_by: session.user.id,
      created_by_name: session.user.name ?? "이름 없음",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ team: data }, { status: 201 });
}
