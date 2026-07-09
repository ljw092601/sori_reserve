"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function EditForm({
  teamId,
  initial,
}: {
  teamId: string;
  initial: { name: string; song: string; members: string };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState(initial.name);
  const [song, setSong] = useState(initial.song);
  const [members, setMembers] = useState(initial.members);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch(`/api/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, song, members }),
    });

    if (res.ok) {
      router.push(`/teams/${teamId}`);
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => null);
    setError(data?.error ?? "수정에 실패했습니다.");
    setSubmitting(false);
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="mb-6 text-xl font-bold">팀 수정</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          팀 이름
          <input
            type="text"
            required
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white p-2.5"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          하고 싶은 곡 (선택)
          <input
            type="text"
            value={song}
            onChange={(e) => setSong(e.target.value)}
            placeholder="예: 잔나비 - 주저하는 연인들을 위해"
            className="rounded-lg border border-zinc-300 bg-white p-2.5"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          팀원 (선택)
          <textarea
            rows={3}
            value={members}
            onChange={(e) => setMembers(e.target.value)}
            placeholder="예: 보컬 홍길동 / 기타 김철수 / 드럼 모집 중"
            className="rounded-lg border border-zinc-300 bg-white p-2.5"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-zinc-900 p-3 font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {submitting ? "저장 중..." : "수정 저장"}
        </button>
      </form>
    </div>
  );
}
