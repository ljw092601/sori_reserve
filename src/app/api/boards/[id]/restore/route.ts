import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { dbErrorResponse } from "@/lib/api-error";
import { isExecutive } from "@/lib/roles";
import { purgeExpiredBoards } from "@/lib/boards";

/**
 * POST /api/boards/[id]/restore — 삭제 대기 중인 게시판 되돌리기 (임원 전용)
 * 유예기간(24시간)이 지나 영구 삭제된 게시판은 되돌릴 수 없다.
 */
export async function POST(
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
  if (!(await isExecutive(session.user.id))) {
    return NextResponse.json(
      { error: "게시판 관리는 임원만 할 수 있습니다." },
      { status: 403 }
    );
  }

  const { id } = await params;

  // 유예기간이 지난 게시판을 먼저 정리해, 만료된 게시판이 되살아나는 일이 없게 한다
  await purgeExpiredBoards();

  const supabase = supabaseAdmin();
  const { data: board, error: findError } = await supabase
    .from("boards")
    .select("id, deleted_at")
    .eq("id", id)
    .single();

  // PGRST116(결과 0건)·22P02(uuid 형식 오류)는 "없는 게시판", 그 외는 DB 장애
  if (findError && findError.code !== "PGRST116" && findError.code !== "22P02") {
    return NextResponse.json(
      { error: "게시판 조회에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
  if (!board) {
    return NextResponse.json(
      { error: "게시판을 찾을 수 없습니다. 되돌리기 기간이 지났을 수 있어요." },
      { status: 404 }
    );
  }
  if (!board.deleted_at) {
    return NextResponse.json(
      { error: "삭제 대기 중인 게시판이 아닙니다." },
      { status: 400 }
    );
  }

  // 삭제 대기 상태일 때만 원자적으로 복구 — 다른 요청의 purge와 경합해
  // 이미 영구 삭제됐다면 0행 매칭(PGRST116)으로 실패해야 한다
  const { error } = await supabase
    .from("boards")
    .update({ deleted_at: null })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id")
    .single();
  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "게시판을 찾을 수 없습니다. 되돌리기 기간이 지났을 수 있어요." },
        { status: 404 }
      );
    }
    return dbErrorResponse("POST /api/boards/[id]/restore", error);
  }
  return NextResponse.json({ ok: true });
}
