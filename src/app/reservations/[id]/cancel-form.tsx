"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelForm({
  reservationId,
}: {
  reservationId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCancel() {
    if (!confirm("이 예약을 취소할까요?")) return;
    setError(null);
    setSubmitting(true);

    const res = await fetch(`/api/reservations/${reservationId}`, {
      method: "DELETE",
    });

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
        onClick={handleCancel}
        disabled={submitting}
        className="rounded-lg border border-red-300 p-3 font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {submitting ? "취소 중..." : "예약 취소하기"}
      </button>
    </div>
  );
}
