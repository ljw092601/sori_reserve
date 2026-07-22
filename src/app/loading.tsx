/** 페이지 전환 중 표시되는 스켈레톤 (홈 주간 시간표 레이아웃 근사) */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="flex items-center justify-between">
        <div className="h-7 w-44 animate-pulse rounded-lg bg-zinc-200" />
        <div className="flex gap-1.5">
          <div className="h-9 w-20 animate-pulse rounded-xl bg-zinc-200" />
          <div className="h-9 w-20 animate-pulse rounded-xl bg-zinc-200" />
        </div>
      </div>
      <div className="h-[28rem] animate-pulse rounded-2xl border border-[var(--border)] bg-zinc-100" />
    </div>
  );
}
