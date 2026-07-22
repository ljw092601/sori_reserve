import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { dbErrorResponse } from "@/lib/api-error";

/**
 * PATCH /api/profile — 닉네임 변경 (네이버 로그인 필요)
 * body: { nickname }
 * 기존에 쓴 예약/모집글/댓글의 표시 이름도 함께 갱신한다.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  let body: { nickname?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const nickname = body.nickname?.trim();
  if (!nickname) {
    return NextResponse.json(
      { error: "닉네임을 입력해주세요." },
      { status: 400 }
    );
  }
  if (nickname.length > 20) {
    return NextResponse.json(
      { error: "닉네임은 20자 이내로 입력해주세요." },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const supabase = supabaseAdmin();

  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    nickname,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return dbErrorResponse("PATCH /api/profile", error);
  }

  // 기존 글/예약/댓글의 표시 이름도 새 닉네임으로 통일
  await Promise.all([
    supabase
      .from("reservations")
      .update({ created_by_name: nickname })
      .eq("created_by", userId),
    supabase
      .from("teams")
      .update({ created_by_name: nickname })
      .eq("created_by", userId),
    supabase
      .from("comments")
      .update({ created_by_name: nickname })
      .eq("created_by", userId),
  ]);

  return NextResponse.json({ ok: true, nickname });
}
