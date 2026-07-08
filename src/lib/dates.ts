// 한국 시간(KST, UTC+9) 기준 날짜 계산 헬퍼.
// 서버가 UTC(Vercel)여도 동일하게 동작하도록 고정 오프셋을 쓴다. (한국은 서머타임 없음)

const KST_OFFSET_MS = 9 * 3_600_000;

/** Date → KST 기준 YYYY-MM-DD */
export function kstDateString(d: Date): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** YYYY-MM-DD에 n일 더하기 */
export function addDays(dateStr: string, n: number): string {
  const t = Date.parse(dateStr + "T00:00:00Z") + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** 해당 날짜가 속한 주의 월요일 (YYYY-MM-DD) */
export function mondayOf(dateStr: string): string {
  const dow = new Date(dateStr + "T00:00:00Z").getUTCDay(); // 0=일
  return addDays(dateStr, -((dow + 6) % 7));
}

/** 해당 날짜의 KST 자정 epoch (ms) */
export function dayStartEpoch(dateStr: string): number {
  return Date.parse(dateStr + "T00:00:00+09:00");
}

/**
 * KST 기준 날짜(YYYY-MM-DD) + 시각(HH:mm) → ISO 문자열.
 * `new Date("YYYY-MM-DDTHH:mm")`은 실행 환경의 로컬 타임존으로 해석되므로
 * 브라우저가 KST가 아니면 시간이 밀린다 — 반드시 이 헬퍼를 쓸 것.
 */
export function kstToIso(dateStr: string, time: string): string {
  return new Date(`${dateStr}T${time}:00+09:00`).toISOString();
}
