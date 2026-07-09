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
        className="rounded-xl border border-[var(--border)] bg-white p-2.5 text-sm outline-none focus:border-[var(--brand-mid)] focus:ring-2 focus:ring-violet-200 transition-shadow"
      />
      {error && (
        <p className="rounded-xl bg-red-50 p-2 text-xs text-red-600">{error}</p>
      )}
      <button
        type="submit"
        disabled={submitting || !content.trim()}
        className="self-end rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 hover:shadow-md active:scale-95 disabled:opacity-50"
        style={{ background: "var(--brand-gradient)" }}
      >
        {submitting ? "등록 중..." : "댓글 달기"}
      </button>
    </form>
  );
}
