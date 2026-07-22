import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { dbErrorResponse } from "@/lib/api-error";
import { validateBlockRange, validateRange } from "@/lib/validate";
import { isAdminBlockTeam, isReservationCategory } from "@/lib/constants";
import { findRuleConflict, ruleLabel } from "@/lib/block-rules";
import { isExecutive } from "@/lib/roles";

/** 조인된 팀 이름 꺼내기 — supabase 조인 결과는 배열일 수 있다 */
const joinedTeamName = (team: unknown): string =>
  (Array.isArray(team) ? team[0]?.name : (team as { name?: string })?.name) ??
  "";

/**
 * PATCH /api/reservations/[id] — 예약 수정
 * 예약자 본인, 또는 사용 금지 예약이면 임원 누구나.
 * body: { category, teamId?, title?, startsAt, endsAt, note? }
 * 팀(teamId)은 합주(ensemble)일 때만 필수.
 * 제목(title)은 기타(etc)일 때만 필수 — 합주는 팀명, 개인연습은 예약자 이름이 제목이 된다.
 */
export async function PATCH(
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

  // 카테고리 도입 전 클라이언트와의 호환을 위해 기본값은 합주
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

  const { data: reservation, error: findError } = await supabase
    .from("reservations")
    .select("id, created_by, team_id, team:teams(name)")
    .eq("id", id)
    .single();
  // PGRST116(결과 0건)·22P02(uuid 형식 오류)는 "없는 예약", 그 외는 DB 장애
  if (
    findError &&
    findError.code !== "PGRST116" &&
    findError.code !== "22P02"
  ) {
    return NextResponse.json(
      { error: "예약 조회에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
  if (!reservation) {
    return NextResponse.json(
      { error: "예약을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 사용 금지 예약은 임원이 다같이 관리한다 — 만든 사람이라도 임원에서
  // 물러났으면 더는 관리할 수 없다 (일반 예약은 기존대로 본인만)
  const isOwner = reservation.created_by === session.user.id;
  const isBlock = isAdminBlockTeam(joinedTeamName(reservation.team));
  const exec = await isExecutive(session.user.id);
  if (isBlock ? !exec : !isOwner) {
    return NextResponse.json(
      {
        error: isBlock
          ? "사용 금지 예약은 임원만 수정할 수 있습니다."
          : "본인이 만든 예약만 수정할 수 있습니다.",
      },
      { status: 403 }
    );
  }

  // 일반 예약을 사용 금지 팀으로 바꿔치기하는 것도 막는다 (POST와 같은 규칙)
  // 합주가 아니면 팀 없이 저장되므로 사용 금지일 수 없다
  let newIsBlock = false;
  if (category === "ensemble") {
    newIsBlock = isBlock;
    if (teamId !== reservation.team_id) {
      const { data: newTeam, error: newTeamError } = await supabase
        .from("teams")
        .select("name")
        .eq("id", teamId)
        .single();
      // PGRST116(결과 0건)·22P02(uuid 형식 오류)는 "없는 팀", 그 외는 DB 장애
      if (
        newTeamError &&
        newTeamError.code !== "PGRST116" &&
        newTeamError.code !== "22P02"
      ) {
        return NextResponse.json(
          { error: "팀 조회에 실패했습니다. 잠시 후 다시 시도해주세요." },
          { status: 500 }
        );
      }
      if (!newTeam) {
        return NextResponse.json(
          { error: "팀을 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      newIsBlock = isAdminBlockTeam(newTeam.name);
      if (newIsBlock && !exec) {
        return NextResponse.json(
          { error: "사용 금지 시간 등록은 임원만 할 수 있습니다." },
          { status: 403 }
        );
      }
    }
  }

  // 사용 금지 예약은 일반 규칙(시간 제한·14일·과거 금지)을 적용하지 않는다
  // — 몇 주 뒤 회차 수정, 이미 시작된 금지의 종료 단축 같은 관리 작업 때문
  const rangeError = (newIsBlock ? validateBlockRange : validateRange)(
    new Date(startsAt),
    new Date(endsAt)
  );
  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400 });
  }

  // 정기 사용 금지 규칙과 겹치는 시간으로는 옮길 수 없다 (사용 금지 예약은 예외)
  if (!newIsBlock) {
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

  const { data, error } = await supabase
    .from("reservations")
    .update({
      // 합주가 아니면 teamId가 와도 무시한다 (팀 없는 예약)
      team_id: category === "ensemble" ? teamId : null,
      category,
      // 제목은 기타에서만 저장 — 다른 목적으로 바꾸면 이전 제목을 지운다
      title: category === "etc" ? title : null,
      starts_at: startsAt,
      ends_at: endsAt,
      note: note?.trim() || null,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    // 23P01: 다른 예약과 시간이 겹침 (자기 자신과는 겹침 판정 안 됨)
    if (error.code === "23P01") {
      return NextResponse.json(
        { error: "이미 그 시간에 다른 예약이 있습니다." },
        { status: 409 }
      );
    }
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "팀을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    return dbErrorResponse("PATCH /api/reservations/[id]", error);
  }
  return NextResponse.json({ reservation: data });
}

/**
 * DELETE /api/reservations/[id] — 예약 취소
 * 예약자 본인, 또는 사용 금지 예약이면 임원 누구나.
 * ?series=true 를 주면 같은 반복 묶음(series_id)의 예약을 전부 취소한다.
 */
export async function DELETE(
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
  const supabase = supabaseAdmin();

  const { data: reservation, error: findError } = await supabase
    .from("reservations")
    .select("id, created_by, series_id, team:teams(name)")
    .eq("id", id)
    .single();
  // PGRST116(결과 0건)·22P02(uuid 형식 오류)는 "없는 예약", 그 외는 DB 장애
  if (
    findError &&
    findError.code !== "PGRST116" &&
    findError.code !== "22P02"
  ) {
    return NextResponse.json(
      { error: "예약 조회에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
  if (!reservation) {
    return NextResponse.json(
      { error: "예약을 찾을 수 없습니다." },
      { status: 404 }
    );
  }
  // 사용 금지 예약은 임원이 다같이 관리한다 — 만든 사람이라도 임원에서
  // 물러났으면 더는 관리할 수 없다 (일반 예약은 기존대로 본인만)
  const isOwner = reservation.created_by === session.user.id;
  const isBlock = isAdminBlockTeam(joinedTeamName(reservation.team));
  if (isBlock ? !(await isExecutive(session.user.id)) : !isOwner) {
    return NextResponse.json(
      {
        error: isBlock
          ? "사용 금지 예약은 임원만 취소할 수 있습니다."
          : "본인이 만든 예약만 취소할 수 있습니다.",
      },
      { status: 403 }
    );
  }

  const deleteSeries =
    req.nextUrl.searchParams.get("series") === "true" &&
    !!reservation.series_id;

  const query = deleteSeries
    ? supabase
        .from("reservations")
        .delete()
        .eq("series_id", reservation.series_id)
        // 만든 사람의 반복 묶음만 (안전장치) — 임원이 취소해도 원래 만든 사람 기준
        .eq("created_by", reservation.created_by)
    : supabase.from("reservations").delete().eq("id", id);

  const { error } = await query;
  if (error) {
    return dbErrorResponse("DELETE /api/reservations/[id]", error);
  }
  return NextResponse.json({ ok: true });
}
