import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { dbErrorResponse } from "@/lib/api-error";
import { isExecutive } from "@/lib/roles";

/** 임원 확인 — 통과하면 null, 아니면 에러 응답 반환 */
async function requireExecutive() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }
  if (!(await isExecutive(session.user.id))) {
    return NextResponse.json(
      { error: "게시판 관리는 임원만 할 수 있습니다." },
      { status: 403 }
    );
  }
  return null;
}

/** 게시판 조회 — { board } 또는 { fail: 에러 응답 } */
async function findBoard(id: string) {
  const supabase = supabaseAdmin();
  const { data: board, error } = await supabase
    .from("boards")
    .select("id, deleted_at")
    .eq("id", id)
    .single();

  // PGRST116(결과 0건)·22P02(uuid 형식 오류)는 "없는 게시판", 그 외는 DB 장애
  if (error && error.code !== "PGRST116" && error.code !== "22P02") {
    return {
      board: null,
      fail: NextResponse.json(
        { error: "게시판 조회에 실패했습니다. 잠시 후 다시 시도해주세요." },
        { status: 500 }
      ),
    };
  }
  if (!board) {
    return {
      board: null,
      fail: NextResponse.json(
        { error: "게시판을 찾을 수 없습니다." },
        { status: 404 }
      ),
    };
  }
  return { board, fail: null };
}

/**
 * PATCH /api/boards/[id] — 게시판 이름 변경 (임원 전용)
 * body: { name(공연 이름) }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireExecutive();
  if (denied) return denied;

  const { id } = await params;

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

  const found = await findBoard(id);
  if (found.fail) return found.fail;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("boards")
    .update({ name })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    // PGRST116 = 결과 0건 — 조회와 수정 사이에 게시판이 삭제된 경합
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "게시판을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    return dbErrorResponse("PATCH /api/boards/[id]", error);
  }
  return NextResponse.json({ board: data });
}

/**
 * DELETE /api/boards/[id] — 게시판 삭제 대기 등록 (임원 전용)
 * 바로 지우지 않고 deleted_at만 기록한다. 유예기간(24시간) 안에는
 * POST /api/boards/[id]/restore 로 되돌릴 수 있고, 지나면 영구 삭제된다.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireExecutive();
  if (denied) return denied;

  const { id } = await params;

  const found = await findBoard(id);
  if (found.fail) return found.fail;
  if (found.board.deleted_at) {
    return NextResponse.json(
      { error: "이미 삭제 대기 중인 게시판입니다." },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("boards")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return dbErrorResponse("DELETE /api/boards/[id]", error);
  }
  return NextResponse.json({ ok: true });
}
