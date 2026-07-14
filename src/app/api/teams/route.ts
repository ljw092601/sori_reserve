import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { TEAM_COLORS, isAdminBlockTeam } from "@/lib/constants";
import { isExecutive } from "@/lib/roles";
import { parseMemberEntries, parseSongUrl } from "@/lib/validate";
import { displayName } from "@/lib/profile";

const TEAM_SELECT =
  "id, board_id, name, color, status, members, content, song_url, created_by, created_by_name, created_at";

/**
 * GET /api/teams — 모집글(팀) 목록 (로그인 불필요)
 * ?status=recruiting|closed 로 모집 상태 필터 (예약 폼은 closed만 사용)
 * 삭제 대기 게시판의 팀은 제외 — purge 때 예약까지 사라지므로 새 예약을 받으면 안 된다.
 */
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");

  const supabase = supabaseAdmin();
  let query = supabase
    .from("teams")
    .select(`${TEAM_SELECT}, boards(deleted_at)`)
    .order("created_at", { ascending: false });
  if (status === "recruiting" || status === "closed") {
    query = query.eq("status", status);
  }
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // 게시판 없는 팀(사용금지 등 관리용)은 boards가 null이라 그대로 통과한다
  const teams = (data ?? [])
    .filter(
      (t) =>
        !(t.boards as unknown as { deleted_at: string | null } | null)
          ?.deleted_at
    )
    .map((t) => {
      const { boards, ...team } = t;
      return team;
    });
  return NextResponse.json({ teams });
}

/**
 * POST /api/teams — 팀원 모집글 쓰기 (네이버 로그인 필요)
 * body: { board_id(게시판), name(곡 제목), status?, members?: {session, name}[], content?, song_url? }
 * 색상은 사용 중이 아닌 팔레트 색을 자동 배정.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  let body: {
    board_id?: string;
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
  // "사용금지"가 들어간 이름은 예약 API가 임원 전용 관리 팀으로 취급하므로
  // 일반 부원이 쓰면 본인도 예약·수정 못 하는 잠긴 글이 된다
  if (isAdminBlockTeam(name) && !(await isExecutive(session.user.id))) {
    return NextResponse.json(
      { error: "곡 제목에 '사용금지'는 사용할 수 없습니다." },
      { status: 400 }
    );
  }
  const status = body.status ?? "recruiting";
  if (status !== "recruiting" && status !== "closed") {
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

  const boardId = body.board_id?.trim();
  if (!boardId) {
    return NextResponse.json(
      { error: "게시판을 선택해주세요." },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();

  // 게시판 존재 확인 (22P02 = uuid 형식 오류도 "없는 게시판" 취급)
  // 삭제 대기 중인 게시판에는 새 글을 받지 않는다
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, deleted_at")
    .eq("id", boardId)
    .maybeSingle();
  if (boardError && boardError.code !== "22P02") {
    return NextResponse.json({ error: boardError.message }, { status: 500 });
  }
  if (!board || board.deleted_at) {
    return NextResponse.json(
      { error: "게시판을 찾을 수 없습니다. 새로고침 후 다시 시도해주세요." },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase.from("teams").select("color");
  const used = new Set((existing ?? []).map((t) => t.color));
  const color =
    TEAM_COLORS.find((c) => !used.has(c)) ??
    TEAM_COLORS[(existing?.length ?? 0) % TEAM_COLORS.length];

  const { data, error } = await supabase
    .from("teams")
    .insert({
      board_id: boardId,
      name,
      color,
      status,
      members: parsed.entries,
      content: body.content?.trim() || null,
      song_url: song.url,
      created_by: session.user.id,
      created_by_name: await displayName(
        session.user.id,
        session.user.name ?? "이름 없음"
      ),
    })
    .select("id")
    .single();

  if (error) {
    // 23503 = FK 위반 — 존재 확인과 insert 사이에 게시판이 삭제된 경합
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "게시판을 찾을 수 없습니다. 새로고침 후 다시 시도해주세요." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ team: data }, { status: 201 });
}
