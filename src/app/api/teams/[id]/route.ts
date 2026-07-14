import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { parseMemberEntries, parseSongUrl } from "@/lib/validate";

/** 팀(모집글) 조회 — { team } 또는 { fail: 에러 응답 } */
async function findTeam(id: string) {
  const supabase = supabaseAdmin();
  const { data: team, error } = await supabase
    .from("teams")
    .select("id, created_by")
    .eq("id", id)
    .single();

  // PGRST116(결과 0건)·22P02(uuid 형식 오류)는 "없는 글", 그 외는 DB 장애
  if (error && error.code !== "PGRST116" && error.code !== "22P02") {
    return {
      team: null,
      fail: NextResponse.json(
        { error: "모집글 조회에 실패했습니다. 잠시 후 다시 시도해주세요." },
        { status: 500 }
      ),
    };
  }
  if (!team) {
    return {
      team: null,
      fail: NextResponse.json(
        { error: "모집글을 찾을 수 없습니다." },
        { status: 404 }
      ),
    };
  }
  return { team, fail: null };
}

/**
 * PATCH /api/teams/[id] — 모집글 수정 (로그인한 누구나)
 * body: { name(곡 제목), status, members?: {session, name}[], content?, song_url? }
 * 전체 필드 교체 방식 — 생략한 선택 필드(content, song_url)는 null로 저장되므로
 * 호출자는 항상 모든 필드를 보내야 한다 (수정 폼이 그렇게 동작).
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

  let body: {
    name?: string;
    status?: string;
    members?: unknown;
    content?: string;
    song_url?: unknown;
  };
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
  if (body.status !== "recruiting" && body.status !== "closed") {
    return NextResponse.json(
      { error: "모집 상태 값이 올바르지 않습니다." },
      { status: 400 }
    );
  }
  const parsed = parseMemberEntries(body.members);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const song = parseSongUrl(body.song_url);
  if ("error" in song) {
    return NextResponse.json({ error: song.error }, { status: 400 });
  }

  const found = await findTeam(id);
  if (found.fail) return found.fail;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("teams")
    .update({
      name,
      status: body.status,
      members: parsed.entries,
      content: body.content?.trim() || null,
      song_url: song.url,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ team: data });
}

/**
 * DELETE /api/teams/[id] — 모집글 삭제 (작성자 본인만)
 * 주의: 이 팀의 예약·댓글도 함께 삭제된다 (FK on delete cascade).
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
      { error: "본인이 쓴 모집글만 삭제할 수 있습니다." },
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
