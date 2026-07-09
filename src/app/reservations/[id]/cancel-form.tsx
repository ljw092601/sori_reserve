"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelForm({
  reservationId,
  isSeries = false,
}: {
  reservationId: string;
  isSeries?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCancel(series: boolean) {
    const message = series
      ? "이 반복 예약 전체를 취소할까요?\n같은 묶음의 모든 주차 예약이 삭제됩니다."
      : "이 예약을 취소할까요?";
    if (!confirm(message)) return;
    setError(null);
    setSubmitting(true);

    const res = await fetch(
      `/api/reservations/${reservationId}${series ? "?series=true" : ""}`,
      { method: "DELETE" }
    );

    if (res.ok) {
      router.push("/");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => null);
    setError(data?.error ?? "취소에 실패했습니다.");
    setSubmitting(false);
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}
      <button
        onClick={() => handleCancel(false)}
        disabled={submitting}
        className="rounded-lg border border-red-300 p-3 font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {submitting ? "취소 중..." : isSeries ? "이 예약만 취소" : "예약 취소하기"}
      </button>
      {isSeries && (
        <button
          onClick={() => handleCancel(true)}
          disabled={submitting}
          className="rounded-lg bg-red-600 p-3 font-medium text-white hover:bg-red-500 disabled:opacity-50"
        >
          {submitting ? "취소 중..." : "반복 예약 전체 취소"}
        </button>
      )}
    </div>
  );
}
