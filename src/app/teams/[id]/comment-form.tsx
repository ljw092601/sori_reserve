"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function CommentForm({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch(`/api/teams/${teamId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (res.ok) {
      setContent("");
      setSubmitting(false);
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => null);
    setError(data?.error ?? "댓글 등록에 실패했습니다.");
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
        maxLength={500}
        rows={2}
        placeholder="예: 베이스 지원합니다!"
        className="rounded-lg border border-zinc-300 bg-white p-2.5 text-sm"
      />
      {error && (
        <p className="rounded-lg bg-red-50 p-2 text-xs text-red-600">{error}</p>
      )}
      <button
        type="submit"
        disabled={submitting || !content.trim()}
        className="self-end rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {submitting ? "등록 중..." : "댓글 달기"}
      </button>
    </form>
  );
}
