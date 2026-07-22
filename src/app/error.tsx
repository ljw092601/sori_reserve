"use client"; // 에러 바운더리는 클라이언트 컴포넌트여야 함

import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
      <h2 className="mb-2 font-semibold text-red-800">문제가 발생했습니다</h2>
      <p className="text-sm text-zinc-700">
        페이지를 표시하는 중 오류가 났어요. 잠시 후 다시 시도해주세요.
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-zinc-400">오류 코드: {error.digest}</p>
      )}
      <button
        onClick={() => unstable_retry()}
        className="mt-4 rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--brand-text)] shadow-sm hover:bg-[var(--brand-soft)] transition-colors"
      >
        다시 시도
      </button>
    </div>
  );
}
