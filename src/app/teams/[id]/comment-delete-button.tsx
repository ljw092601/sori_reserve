"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CommentDeleteButton({
  commentId,
}: {
  commentId: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("댓글을 삭제할까요?")) return;
    setDeleting(true);

    const res = await fetch(`/api/comments/${commentId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => null);
    alert(data?.error ?? "삭제에 실패했습니다.");
    setDeleting(false);
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-xs text-zinc-400 underline hover:text-red-600 disabled:opacity-50"
    >
      삭제
    </button>
  );
}
