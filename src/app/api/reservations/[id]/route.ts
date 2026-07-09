import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { validateRange } from "@/lib/validate";

/**
 * PATCH /api/reservations/[id] — 예약 수정 (예약자 본인만)
 * body: { teamId, startsAt, endsAt, note? }
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

  const { data: reservation, error: findError } = await supabase
    .from("reservations")
    .select("id, created_by")
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
  if (reservation.created_by !== session.user.id) {
    return NextResponse.json(
      { error: "본인이 만든 예약만 수정할 수 있습니다." },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("reservations")
    .update({
      team_id: teamId,
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ reservation: data });
}

/**
 * DELETE /api/reservations/[id] — 예약 취소
 * 로그인한 사용자가 본인이 만든 예약만 취소할 수 있다.
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
    .select("id, created_by, series_id")
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
  if (reservation.created_by !== session.user.id) {
    return NextResponse.json(
      { error: "본인이 만든 예약만 취소할 수 있습니다." },
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
        .eq("created_by", session.user.id) // 본인 예약만 (안전장치)
    : supabase.from("reservations").delete().eq("id", id);

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
