import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { dbErrorResponse } from "@/lib/api-error";

/** DELETE /api/comments/[id] — 댓글 삭제 (작성자 본인만) */
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
  const supabase = supabaseAdmin();

  const { data: comment, error: findError } = await supabase
    .from("comments")
    .select("id, created_by")
    .eq("id", id)
    .single();

  // PGRST116(결과 0건)·22P02(uuid 형식 오류)는 "없는 댓글", 그 외는 DB 장애
  if (
    findError &&
    findError.code !== "PGRST116" &&
    findError.code !== "22P02"
  ) {
    return NextResponse.json(
      { error: "댓글 조회에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
  if (!comment) {
    return NextResponse.json(
      { error: "댓글을 찾을 수 없습니다." },
      { status: 404 }
    );
  }
  if (comment.created_by !== session.user.id) {
    return NextResponse.json(
      { error: "본인이 쓴 댓글만 삭제할 수 있습니다." },
      { status: 403 }
    );
  }

  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) {
    return dbErrorResponse("DELETE /api/comments/[id]", error);
  }
  return NextResponse.json({ ok: true });
}
