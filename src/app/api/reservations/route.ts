import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { validateRange } from "@/lib/validate";
import { RULES } from "@/lib/constants";
import { dayStartEpoch, kstDateString } from "@/lib/dates";

const RESERVATION_SELECT =
  "id, team_id, starts_at, ends_at, note, created_by, created_by_name, created_at, team:teams(id, name, color)";

/**
 * GET /api/reservations?from=ISO&to=ISO — 기간과 겹치는 예약 목록 (로그인 불필요)
 * from/to 생략 시 오늘부터 예약 가능 기간 끝까지.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  // 기본값은 KST 기준 오늘 자정부터 — UTC 날짜를 쓰면 KST 00~09시에 하루가 밀린다
  const todayStartMs = dayStartEpoch(kstDateString(new Date()));
  const from =
    searchParams.get("from") ?? new Date(todayStartMs).toISOString();
  const to =
    searchParams.get("to") ??
    new Date(
      todayStartMs + (RULES.MAX_DAYS_AHEAD + 1) * 86_400_000
    ).toISOString();

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .gt("ends_at", from)
    .lt("starts_at", to)
    .order("starts_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ reservations: data });
}

/**
 * POST /api/reservations — 예약 생성 (네이버 로그인 필요)
 * body: { teamId, startsAt, endsAt, note? }
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
    teamId?: string;
    startsAt?: string;
    endsAt?: string;
    note?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { teamId, startsAt, endsAt, note } = body;
  if (!teamId || !startsAt || !endsAt) {
    return NextResponse.json(
      { error: "팀, 시작/종료 시간은 필수입니다." },
      { status: 400 }
    );
  }

  const rangeError = validateRange(new Date(startsAt), new Date(endsAt));
  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("reservations")
    .insert({
      team_id: teamId,
      starts_at: startsAt,
      ends_at: endsAt,
      note: note?.trim() || null,
      created_by: session.user.id,
      created_by_name: session.user.name ?? "이름 없음",
    })
    .select(RESERVATION_SELECT)
    .single();

  if (error) {
    // 23P01: exclusion constraint 위반 = 다른 예약과 시간이 겹침
    if (error.code === "23P01") {
      return NextResponse.json(
        { error: "이미 그 시간에 다른 예약이 있습니다." },
        { status: 409 }
      );
    }
    // 23503: FK 위반 = 존재하지 않는 팀
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "팀을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ reservation: data }, { status: 201 });
}
