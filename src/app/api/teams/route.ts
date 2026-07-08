import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/** GET /api/teams — 팀 목록 (비밀번호 해시는 절대 포함하지 않음) */
export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, color")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ teams: data });
}
