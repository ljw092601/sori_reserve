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
        members: form.get("members"),
        content: form.get("content"),
      }),
    });

    if (res.ok) {
      router.push("/teams");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => null);
    setError(data?.error ?? "모집글 등록에 실패했습니다.");
    setSubmitting(false);
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="mb-6 text-xl font-bold">팀원 모집글 쓰기</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          곡 제목
          <input
            type="text"
            name="name"
            required
            maxLength={50}
            placeholder="예: 잔나비 - 주저하는 연인들을 위해"
            className="rounded-lg border border-zinc-300 bg-white p-2.5"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          현재 모인 팀원 (선택)
          <input
            type="text"
            name="members"
            placeholder="예: 보컬 홍길동, 기타 김철수"
            className="rounded-lg border border-zinc-300 bg-white p-2.5"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          모집 글 (선택)
          <textarea
            name="content"
            rows={5}
            placeholder={"예: 드럼, 베이스 구합니다!\n연습은 주 1회 예정이에요."}
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
          {submitting ? "등록 중..." : "모집글 올리기"}
        </button>

        <p className="text-xs text-zinc-500">
          글을 올리면 &apos;모집중&apos; 상태로 시작하고, 예약 페이지의 팀
          목록에 곡 제목이 바로 나타나요. 팀 색상은 자동으로 정해집니다.
        </p>
      </form>
    </div>
  );
}
