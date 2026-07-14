import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { validateBlockRange, validateRange } from "@/lib/validate";
import {
  isAdminBlockTeam,
  isReservationCategory,
  RULES,
} from "@/lib/constants";
import { findRuleConflict, ruleLabel } from "@/lib/block-rules";
import { dayStartEpoch, kstDateString } from "@/lib/dates";
import { displayName } from "@/lib/profile";
import { isExecutive } from "@/lib/roles";

const RESERVATION_SELECT =
  "id, team_id, category, starts_at, ends_at, title, note, created_by, created_by_name, created_at, team:teams(id, name, color)";

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
 * body: { category, teamId?, title?, startsAt, endsAt, note? }
 * 팀(teamId)은 합주(ensemble)일 때만 필수 — 개인연습/기타는 팀 없이 저장한다.
 * 제목(title)은 기타(etc)일 때만 필수 — 합주는 팀명, 개인연습은 예약자 이름이 제목이 된다.
 * 정기 사용 금지 규칙(block_rules)과 겹치는 일반 예약은 거부한다.
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
    title?: string;
    startsAt?: string;
    endsAt?: string;
    note?: string;
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
  const title = body.title?.trim();
  if (category === "etc" && !title) {
    return NextResponse.json(
      { error: "기타 예약은 제목을 입력해주세요." },
      { status: 400 }
    );
  }
  if (title && title.length > 50) {
    return NextResponse.json(
      { error: "제목은 50자 이내로 입력해주세요." },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();

  // 사용 금지 팀 예약은 임원 전용 — UI에서 숨기는 것과 별개로 여기서 강제한다
  // 합주가 아니면 팀 없이 저장되므로 사용 금지일 수 없다
  let isBlock = false;
  if (category === "ensemble") {
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("name")
      .eq("id", teamId)
      .single();
    // PGRST116(결과 0건)·22P02(uuid 형식 오류)는 "없는 팀", 그 외는 DB 장애
    if (
      teamError &&
      teamError.code !== "PGRST116" &&
      teamError.code !== "22P02"
    ) {
      return NextResponse.json(
        { error: "팀 조회에 실패했습니다. 잠시 후 다시 시도해주세요." },
        { status: 500 }
      );
    }
    if (!team) {
      return NextResponse.json(
        { error: "팀을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    isBlock = isAdminBlockTeam(team.name);
    if (isBlock && !(await isExecutive(session.user.id))) {
      return NextResponse.json(
        { error: "사용 금지 시간 등록은 임원만 할 수 있습니다." },
        { status: 403 }
      );
    }
  }
  // 사용 금지는 관리용이라 일반 예약 규칙(시간 제한·14일)을 적용하지 않는다
  const rangeError = (isBlock ? validateBlockRange : validateRange)(
    new Date(startsAt),
    new Date(endsAt)
  );
  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400 });
  }

  // 정기 사용 금지 규칙과 겹치는 일반 예약은 거부 (사용 금지 등록 자체는 예외)
  if (!isBlock) {
    const { data: rules, error: rulesError } = await supabase
      .from("block_rules")
      .select("*");
    // 42P01(테이블 없음 = 마이그레이션 전)만 규칙 없음으로 취급 — 그 외 조회
    // 실패까지 통과시키면 일시 장애 때 금지 시간이 뚫린다
    if (rulesError && rulesError.code !== "42P01") {
      return NextResponse.json(
        { error: "사용 금지 규칙 확인에 실패했습니다. 잠시 후 다시 시도해주세요." },
        { status: 500 }
      );
    }
    const conflict = findRuleConflict(rules ?? [], startsAt, endsAt);
    if (conflict) {
      return NextResponse.json(
        {
          error: `${ruleLabel(conflict)}은 사용 금지 시간입니다.${
            conflict.note ? ` (${conflict.note})` : ""
          }`,
        },
        { status: 409 }
      );
    }
  }

  const createdByName = await displayName(
    session.user.id,
    session.user.name ?? "이름 없음"
  );

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      // 합주가 아니면 클라이언트가 teamId를 보냈어도 무시한다 (팀 없는 예약)
      team_id: category === "ensemble" ? teamId : null,
      category,
      // 제목은 기타에서만 저장 — 개인연습은 created_by_name이 제목 역할을 한다
      title: category === "etc" ? title : null,
      starts_at: new Date(Date.parse(startsAt)).toISOString(),
      ends_at: new Date(Date.parse(endsAt)).toISOString(),
      note: note?.trim() || null,
      created_by: session.user.id,
      created_by_name: createdByName,
    })
    .select(RESERVATION_SELECT);

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
  return NextResponse.json(
    { reservations: data, count: data?.length ?? 0 },
    { status: 201 }
  );
}
