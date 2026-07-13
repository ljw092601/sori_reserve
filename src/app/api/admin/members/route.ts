import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isExecutive, type Role } from "@/lib/roles";
import { DEV_ACCOUNTS } from "@/lib/dev-accounts";

/** 임원 관리 목록의 한 사람 */
export type AdminMember = {
  id: string;
  name: string;
  role: Role;
  /** 본인 여부 — 본인 역할은 변경할 수 없다 */
  self: boolean;
};

/**
 * GET /api/admin/members — 역할 관리용 사용자 목록 (임원 전용)
 * 한 번이라도 로그인한 사용자는 profiles에 행이 생겨 여기 나타난다.
 * 개발 환경에서는 테스트 계정도 목록에 합쳐 보여준다.
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
      { error: "임원만 볼 수 있습니다." },
      { status: 403 }
    );
  }

  const supabase = supabaseAdmin();
  // role 컬럼이 아직 없는 DB에서도 목록은 뜨도록 컬럼별로 나눠 조회하지 않고
  // 실패 시 role 없이 재시도한다
  let rows: { id: string; nickname: string | null; role?: string | null }[];
  const withRole = await supabase.from("profiles").select("id, nickname, role");
  if (!withRole.error) {
    rows = withRole.data;
  } else {
    const noRole = await supabase.from("profiles").select("id, nickname");
    if (noRole.error) {
      return NextResponse.json({ error: noRole.error.message }, { status: 500 });
    }
    rows = noRole.data;
  }

  const isDev = process.env.NODE_ENV === "development";
  const byId = new Map(rows.map((r) => [r.id, r]));

  const members: AdminMember[] = rows
    // 프로덕션 목록에 개발용 테스트 계정이 섞이지 않게 한다
    .filter((r) => isDev || !r.id.startsWith("dev-"))
    .map((r) => ({
      id: r.id,
      name: r.nickname ?? "이름 없음",
      role: (r.role === "exec" ? "exec" : "member") as Role,
      self: r.id === session.user.id,
    }));

  if (isDev) {
    // DB에 행이 없는 테스트 계정도 목록에 보이게 병합 (역할은 코드의 기본값)
    for (const a of DEV_ACCOUNTS) {
      if (byId.has(a.id)) {
        // DB 행이 있지만 role 미지정이면 코드의 기본 역할을 보여준다
        const m = members.find((x) => x.id === a.id)!;
        if (!byId.get(a.id)?.role) {
          m.role = a.role === "임원진" ? "exec" : "member";
        }
        continue;
      }
      members.push({
        id: a.id,
        name: a.name,
        role: a.role === "임원진" ? "exec" : "member",
        self: a.id === session.user.id,
      });
    }
  }

  // 임원 먼저, 이름순
  members.sort(
    (a, b) =>
      Number(b.role === "exec") - Number(a.role === "exec") ||
      a.name.localeCompare(b.name, "ko")
  );

  return NextResponse.json({ members });
}

/**
 * PATCH /api/admin/members — 역할 변경 (임원 전용)
 * body: { userId, role: 'exec' | 'member' }
 * 본인 역할은 변경 불가 — 임원이 0명이 되는 사고를 막는다.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }
  if (!(await isExecutive(session.user.id))) {
    return NextResponse.json(
      { error: "임원만 역할을 변경할 수 있습니다." },
      { status: 403 }
    );
  }

  let body: { userId?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { userId, role } = body;
  if (!userId || (role !== "exec" && role !== "member")) {
    return NextResponse.json(
      { error: "userId와 role(exec/member)이 필요합니다." },
      { status: 400 }
    );
  }
  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "본인의 역할은 직접 바꿀 수 없어요. 다른 임원에게 요청해주세요." },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();

  // 마지막 임원 강등 방지 — 본인 변경 금지만으로는 두 임원이 서로를
  // 동시에 강등하는 경우를 못 막는다. 대상을 뺀 임원 수를 확인한다.
  // (개발 환경은 코드에 임원 테스트 계정이 있어 0명이 될 수 없으므로 생략)
  if (role === "member" && process.env.NODE_ENV !== "development") {
    const { count, error: countError } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "exec")
      .neq("id", userId);
    if (countError) {
      return NextResponse.json(
        { error: countError.message },
        { status: 500 }
      );
    }
    if (!count) {
      return NextResponse.json(
        { error: "마지막 임원은 강등할 수 없어요. 새 임원을 먼저 승급해주세요." },
        { status: 400 }
      );
    }
  }

  // 행이 없는 사용자(예: 테스트 계정)도 지정할 수 있게 upsert.
  // ignoreDuplicates 없이 쓰면 기존 행의 nickname까지 덮어쓰므로 update → insert 순서로 처리한다.
  const updated = await supabase
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("id");

  if (updated.error) {
    // 42703(Postgres)/PGRST204(PostgREST 스키마 캐시): role 컬럼이 아직 없음 — 마이그레이션 안내
    if (updated.error.code === "42703" || updated.error.code === "PGRST204") {
      return NextResponse.json(
        {
          error:
            "profiles 테이블에 role 컬럼이 없습니다. Supabase에서 마이그레이션을 먼저 실행해주세요.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: updated.error.message }, { status: 500 });
  }

  if (updated.data.length === 0) {
    const devName = DEV_ACCOUNTS.find((a) => a.id === userId)?.name;
    const inserted = await supabase.from("profiles").insert({
      id: userId,
      nickname: devName ?? "이름 없음",
      role,
      updated_at: new Date().toISOString(),
    });
    if (inserted.error) {
      return NextResponse.json(
        { error: inserted.error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, userId, role });
}
