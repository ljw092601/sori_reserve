import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isExecutive } from "@/lib/roles";
import { parseOptionalText, validateBlockRule } from "@/lib/validate";
import { BLOCK_RULE_NOTE_MAX } from "@/lib/constants";

const RULE_SELECT =
  "id, day_of_week, start_min, end_min, note, created_by, created_by_name, created_at";

/** 임원 확인 — 통과하면 null, 아니면 에러 응답 */
async function denyUnlessExecutive() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }
  if (!(await isExecutive(session.user.id))) {
    return NextResponse.json(
      { error: "임원만 사용 금지 규칙을 관리할 수 있습니다." },
      { status: 403 }
    );
  }
  return null;
}

/**
 * PATCH /api/admin/block-rules/[id] — 규칙 수정 (임원 전용)
 * body: { dayOfWeek, startMin, endMin, note? } — 수정 즉시 모든 주에 반영된다.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await denyUnlessExecutive();
  if (denied) return denied;

  const { id } = await params;

  let body: {
    dayOfWeek?: number;
    startMin?: number;
    endMin?: number;
    note?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const ruleError = validateBlockRule(body.dayOfWeek, body.startMin, body.endMin);
  if (ruleError) {
    return NextResponse.json({ error: ruleError }, { status: 400 });
  }
  const note = parseOptionalText(body.note, BLOCK_RULE_NOTE_MAX, "메모");
  if ("error" in note) {
    return NextResponse.json({ error: note.error }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("block_rules")
    .update({
      day_of_week: body.dayOfWeek,
      start_min: body.startMin,
      end_min: body.endMin,
      note: note.text,
    })
    .eq("id", id)
    .select(RULE_SELECT)
    .maybeSingle();

  if (error) {
    // 22P02: uuid 형식 오류 = 없는 규칙 취급
    if (error.code === "22P02") {
      return NextResponse.json(
        { error: "규칙을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "규칙을 찾을 수 없습니다." },
      { status: 404 }
    );
  }
  return NextResponse.json({ rule: data });
}

/**
 * DELETE /api/admin/block-rules/[id] — 규칙 삭제 (임원 전용)
 * 삭제 즉시 해당 시간대는 다시 예약 가능해진다.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await denyUnlessExecutive();
  if (denied) return denied;

  const { id } = await params;
  const { error } = await supabaseAdmin()
    .from("block_rules")
    .delete()
    .eq("id", id);

  if (error && error.code !== "22P02") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
