"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AccountForm({
  currentNickname,
}: {
  currentNickname: string;
}) {
  const router = useRouter();
  const [nickname, setNickname] = useState(currentNickname);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname }),
    });

    if (res.ok) {
      setSaved(true);
      setSubmitting(false);
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => null);
    setError(data?.error ?? "저장에 실패했습니다.");
    setSubmitting(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5"
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        닉네임
        <input
          type="text"
          required
          maxLength={20}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white p-2.5"
        />
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}
      {saved && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          저장했습니다. 예약·모집글·댓글의 이름도 함께 바뀌었어요.
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-zinc-900 p-3 font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {submitting ? "저장 중..." : "저장"}
      </button>

      <p className="text-xs text-zinc-500">
        닉네임은 예약자 이름, 모집글·댓글 작성자 이름으로 표시됩니다. 이미 쓴
        글의 이름도 함께 바뀌어요.
      </p>
    </form>
  );
}
