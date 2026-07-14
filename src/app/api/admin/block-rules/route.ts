import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isExecutive } from "@/lib/roles";
import { displayName } from "@/lib/profile";
import { validateBlockRule } from "@/lib/validate";

const RULE_SELECT =
  "id, day_of_week, start_min, end_min, note, created_by, created_by_name, created_at";

/** 42P01: block_rules 테이블이 아직 없음 — 마이그레이션 안내로 바꿔준다 */
const ruleTableError = (error: { code?: string; message: string }) =>
  NextResponse.json(
    {
      error:
        error.code === "42P01"
          ? "block_rules 테이블이 없습니다. Supabase에서 마이그레이션을 먼저 실행해주세요."
          : error.message,
    },
    { status: 500 }
  );

/**
 * GET /api/admin/block-rules — 정기 사용 금지 규칙 목록 (임원 전용)
 * 요일·시작 시간순으로 정렬해 반환한다.
 */
export async function GET() {
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

  const { data, error } = await supabaseAdmin()
    .from("block_rules")
    .select(RULE_SELECT)
    .order("day_of_week")
    .order("start_min");

  if (error) return ruleTableError(error);
  return NextResponse.json({ rules: data });
}

/**
 * POST /api/admin/block-rules — 규칙 추가 (임원 전용)
 * body: { dayOfWeek: 0~6(일~토), startMin, endMin, note? } — 분은 KST 자정 기준
 */
export async function POST(req: NextRequest) {
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

  const { data, error } = await supabaseAdmin()
    .from("block_rules")
    .insert({
      day_of_week: body.dayOfWeek,
      start_min: body.startMin,
      end_min: body.endMin,
      note: body.note?.trim() || null,
      created_by: session.user.id,
      created_by_name: await displayName(
        session.user.id,
        session.user.name ?? "이름 없음"
      ),
    })
    .select(RULE_SELECT)
    .single();

  if (error) return ruleTableError(error);
  return NextResponse.json({ rule: data }, { status: 201 });
}
