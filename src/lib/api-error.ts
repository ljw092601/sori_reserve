import { NextResponse } from "next/server";

/**
 * 예기치 못한 DB 오류의 500 응답 헬퍼.
 * Postgres 에러 원문(테이블·컬럼·제약명)은 서버 로그에만 남기고,
 * 클라이언트에는 일반 메시지만 반환한다 — 스키마 정보 노출 방지.
 * 사용자가 고칠 수 있는 오류(겹침·권한·형식 등)는 이 헬퍼를 쓰지 말고
 * 각 라우트에서 구체적인 메시지와 상태 코드로 직접 응답할 것.
 */
export function dbErrorResponse(
  context: string,
  error: { code?: string; message?: string }
) {
  console.error(`[${context}] DB error`, error.code ?? "", error.message ?? "");
  return NextResponse.json(
    { error: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
    { status: 500 }
  );
}
