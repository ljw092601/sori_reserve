"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { TEAM_STATUS_LABEL } from "@/lib/constants";

export default function EditForm({
  teamId,
  initial,
}: {
  teamId: string;
  initial: {
    name: string;
    status: "recruiting" | "closed";
    members: string;
    content: string;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState(initial.name);
  const [status, setStatus] = useState<"recruiting" | "closed">(
    initial.status
  );
  const [members, setMembers] = useState(initial.members);
  const [content, setContent] = useState(initial.content);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch(`/api/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, status, members, content }),
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
      <h1 className="mb-6 text-xl font-bold">모집글 수정</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          곡 제목
          <input
            type="text"
            required
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white p-2.5"
          />
        </label>

        <fieldset className="flex flex-col gap-1 text-sm font-medium">
          <legend className="mb-1">모집 상태</legend>
          <div className="flex gap-2">
            {(["recruiting", "closed"] as const).map((s) => (
              <label
                key={s}
                className={`flex-1 cursor-pointer rounded-lg border p-2.5 text-center text-sm font-medium ${
                  status === s
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500"
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={s}
                  checked={status === s}
                  onChange={() => setStatus(s)}
                  className="sr-only"
                />
                {TEAM_STATUS_LABEL[s]}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1 text-sm font-medium">
          현재 모인 팀원 (선택)
          <input
            type="text"
            value={members}
            onChange={(e) => setMembers(e.target.value)}
            placeholder="예: 보컬 홍길동, 기타 김철수"
            className="rounded-lg border border-zinc-300 bg-white p-2.5"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          모집 글 (선택)
          <textarea
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
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
          {submitting ? "저장 중..." : "수정 저장"}
        </button>
      </form>
    </div>
  );
}
