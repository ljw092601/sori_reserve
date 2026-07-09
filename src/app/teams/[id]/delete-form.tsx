"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteForm({
  teamId,
  teamName,
}: {
  teamId: string;
  teamName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (
      !confirm(
        `'${teamName}' 팀을 삭제할까요?\n이 팀의 예약도 모두 함께 삭제됩니다.`
      )
    ) {
      return;
    }
    setError(null);
    setDeleting(true);

    const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/teams");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => null);
    setError(data?.error ?? "삭제에 실패했습니다.");
    setDeleting(false);
  }

  return (
    <div className="mt-3">
      {error && (
        <p className="mb-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="w-full rounded-lg border border-red-300 p-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {deleting ? "삭제 중..." : "팀 삭제"}
      </button>
    </div>
  );
}
