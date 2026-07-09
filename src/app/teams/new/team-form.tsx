"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function TeamForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        song: form.get("song"),
        members: form.get("members"),
      }),
    });

    if (res.ok) {
      router.push("/teams");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => null);
    setError(data?.error ?? "팀 만들기에 실패했습니다.");
    setSubmitting(false);
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="mb-6 text-xl font-bold">팀 만들기</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          팀 이름
          <input
            type="text"
            name="name"
            required
            maxLength={30}
            placeholder="예: 소나기"
            className="rounded-lg border border-zinc-300 bg-white p-2.5"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          하고 싶은 곡 (선택)
          <input
            type="text"
            name="song"
            placeholder="예: 잔나비 - 주저하는 연인들을 위해"
            className="rounded-lg border border-zinc-300 bg-white p-2.5"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          팀원 (선택)
          <textarea
            name="members"
            rows={3}
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
          {submitting ? "만드는 중..." : "팀 만들기"}
        </button>

        <p className="text-xs text-zinc-500">
          팀을 만들면 예약 페이지의 팀 목록에 바로 나타나요. 팀 색상은 자동으로
          정해집니다.
        </p>
      </form>
    </div>
  );
}
