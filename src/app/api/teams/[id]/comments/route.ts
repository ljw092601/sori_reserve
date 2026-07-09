import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { displayName } from "@/lib/profile";

/**
 * POST /api/teams/[id]/comments — 모집글에 댓글 쓰기 (네이버 로그인 필요)
 * body: { content }
 */
export async function POST(
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

  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!content) {
    return NextResponse.json(
      { error: "댓글 내용을 입력해주세요." },
      { status: 400 }
    );
  }
  if (content.length > 500) {
    return NextResponse.json(
      { error: "댓글은 500자 이내로 입력해주세요." },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("comments")
    .insert({
      team_id: id,
      content,
      created_by: session.user.id,
      created_by_name: await displayName(
        session.user.id,
        session.user.name ?? "이름 없음"
      ),
    })
    .select("id")
    .single();

  if (error) {
    // 23503: FK 위반 = 없는 모집글, 22P02: uuid 형식 오류
    if (error.code === "23503" || error.code === "22P02") {
      return NextResponse.json(
        { error: "모집글을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ comment: data }, { status: 201 });
}
