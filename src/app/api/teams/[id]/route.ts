import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";

/** 팀 조회 — { team } 또는 { fail: 에러 응답 } */
async function findTeam(id: string) {
  const supabase = supabaseAdmin();
  const { data: team, error } = await supabase
    .from("teams")
    .select("id, created_by")
    .eq("id", id)
    .single();

  // PGRST116(결과 0건)·22P02(uuid 형식 오류)는 "없는 팀", 그 외는 DB 장애
  if (error && error.code !== "PGRST116" && error.code !== "22P02") {
    return {
      team: null,
      fail: NextResponse.json(
        { error: "팀 조회에 실패했습니다. 잠시 후 다시 시도해주세요." },
        { status: 500 }
      ),
    };
  }
  if (!team) {
    return {
      team: null,
      fail: NextResponse.json(
        { error: "팀을 찾을 수 없습니다." },
        { status: 404 }
      ),
    };
  }
  return { team, fail: null };
}

/**
 * PATCH /api/teams/[id] — 팀 정보 수정 (로그인한 누구나)
 * body: { name, song?, members? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const { id } = await params;

  let body: { name?: string; song?: string; members?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json(
      { error: "팀 이름은 필수입니다." },
      { status: 400 }
    );
  }
  if (name.length > 30) {
    return NextResponse.json(
      { error: "팀 이름은 30자 이내로 입력해주세요." },
      { status: 400 }
    );
  }

  const found = await findTeam(id);
  if (found.fail) return found.fail;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("teams")
    .update({
      name,
      song: body.song?.trim() || null,
      members: body.members?.trim() || null,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "이미 같은 이름의 팀이 있습니다." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ team: data });
}

/**
 * DELETE /api/teams/[id] — 팀 삭제 (작성자 본인만)
 * 주의: 이 팀의 예약도 함께 삭제된다 (FK on delete cascade).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const { id } = await params;

  const found = await findTeam(id);
  if (found.fail) return found.fail;
  if (
    !found.team.created_by ||
    found.team.created_by !== session.user.id
  ) {
    return NextResponse.json(
      { error: "본인이 만든 팀만 삭제할 수 있습니다." },
      { status: 403 }
    );
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
