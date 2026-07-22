"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteForm({
  teamId,
  teamName,
  backHref,
}: {
  teamId: string;
  teamName: string;
  /** 삭제 후 돌아갈 게시판 주소 */
  backHref: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (
      !confirm(
        `'${teamName}' 모집글을 삭제할까요?\n이 팀의 예약과 댓글도 모두 함께 삭제됩니다.`
      )
    ) {
      return;
    }
    setError(null);
    setDeleting(true);

    try {
      const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
      if (res.ok) {
        // 이동할 때까지 버튼은 비활성으로 둔다 (중복 요청 방지)
        router.push(backHref);
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "삭제에 실패했습니다.");
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
    setDeleting(false);
  }

  return (
    <div className="mt-3">
      {error && (
        <p className="mb-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="w-full rounded-xl border border-red-300 p-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        {deleting ? "삭제 중..." : "모집글 삭제"}
      </button>
    </div>
  );
}
