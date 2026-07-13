import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { validateRange } from "@/lib/validate";
import { RULES, isReservationCategory } from "@/lib/constants";
import { dayStartEpoch, kstDateString } from "@/lib/dates";
import { displayName } from "@/lib/profile";

const RESERVATION_SELECT =
  "id, team_id, category, starts_at, ends_at, note, created_by, created_by_name, created_at, team:teams(id, name, color)";

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
 * body: { category, teamId?, startsAt, endsAt, note?, repeatWeeks? }
 * 팀(teamId)은 합주(ensemble)일 때만 필수 — 개인연습/기타는 팀 없이 저장한다.
 * repeatWeeks(2~15)를 주면 매주 같은 요일/시간으로 N건을 한 번에 생성한다.
 * 한 건이라도 겹치면 전체 실패 (단일 INSERT라 원자적).
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
    category?: string;
    teamId?: string;
    startsAt?: string;
    endsAt?: string;
    note?: string;
    repeatWeeks?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // 카테고리 도입 전 클라이언트(팀만 보내던 버전)와의 호환을 위해 기본값은 합주
  const category = body.category ?? "ensemble";
  if (!isReservationCategory(category)) {
    return NextResponse.json(
      { error: "올바른 예약 목적이 아닙니다." },
      { status: 400 }
    );
  }

  const { teamId, startsAt, endsAt, note } = body;
  if (!startsAt || !endsAt) {
    return NextResponse.json(
      { error: "시작/종료 시간은 필수입니다." },
      { status: 400 }
    );
  }
  if (category === "ensemble" && !teamId) {
    return NextResponse.json(
      { error: "합주 예약은 팀 선택이 필수입니다." },
      { status: 400 }
    );
  }

  const repeatWeeks = body.repeatWeeks ?? 1;
  if (
    !Number.isInteger(repeatWeeks) ||
    repeatWeeks < 1 ||
    repeatWeeks > RULES.MAX_REPEAT_WEEKS
  ) {
    return NextResponse.json(
      { error: `반복은 ${RULES.MAX_REPEAT_WEEKS}주까지 가능합니다.` },
      { status: 400 }
    );
  }

  // 첫 회차만 검증 — 이후 회차는 정확히 7일 간격이라 반복 목적상 14일 제한을 넘을 수 있다
  const rangeError = validateRange(new Date(startsAt), new Date(endsAt));
  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // 매주 반복은 UI처럼 서버에서도 "합주 + 사용금지 팀"으로 제한한다
  // (반복은 14일 제한을 넘을 수 있어, 일반 예약이 이 경로로 우회하면 안 된다)
  if (repeatWeeks > 1) {
    const { data: team } = await supabase
      .from("teams")
      .select("name")
      .eq("id", teamId)
      .single();
    const allowed =
      category === "ensemble" &&
      (team?.name ?? "")
        .replace(/\s/g, "")
        .includes(RULES.REPEAT_TEAM_NAME);
    if (!allowed) {
      return NextResponse.json(
        { error: "매주 반복은 관리용 예약에서만 사용할 수 있습니다." },
        { status: 400 }
      );
    }
  }

  const createdByName = await displayName(
    session.user.id,
    session.user.name ?? "이름 없음"
  );
  // 한국은 서머타임이 없어 7일 = 정확히 7*24시간 (KST 벽시계 시간이 유지된다)
  const WEEK_MS = 7 * 86_400_000;
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);
  const seriesId = repeatWeeks > 1 ? crypto.randomUUID() : null;

  const rows = Array.from({ length: repeatWeeks }, (_, i) => ({
    // 합주가 아니면 클라이언트가 teamId를 보냈어도 무시한다 (팀 없는 예약)
    team_id: category === "ensemble" ? teamId : null,
    category,
    starts_at: new Date(startMs + i * WEEK_MS).toISOString(),
    ends_at: new Date(endMs + i * WEEK_MS).toISOString(),
    note: note?.trim() || null,
    series_id: seriesId,
    created_by: session.user.id,
    created_by_name: createdByName,
  }));

  const { data, error } = await supabase
    .from("reservations")
    .insert(rows)
    .select(RESERVATION_SELECT);

  if (error) {
    // 23P01: exclusion constraint 위반 = 다른 예약과 시간이 겹침
    if (error.code === "23P01") {
      return NextResponse.json(
        {
          error:
            repeatWeeks > 1
              ? "반복 기간 중 이미 겹치는 예약이 있어 전체가 등록되지 않았습니다."
              : "이미 그 시간에 다른 예약이 있습니다.",
        },
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
  return NextResponse.json(
    { reservations: data, count: data?.length ?? 0 },
    { status: 201 }
  );
}
