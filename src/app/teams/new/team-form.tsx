"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { MemberEntry } from "@/lib/types";
import { MembersInput, StatusRadio } from "../form-fields";

export default function TeamForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [status, setStatus] = useState<"recruiting" | "closed">("recruiting");
  const [members, setMembers] = useState<MemberEntry[]>([
    { session: "", name: "" },
  ]);
  const [content, setContent] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, status, members, content }),
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
      <h1 className="mb-6 text-xl font-bold text-[var(--foreground)]">팀원 모집글 쓰기</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          곡 제목
          <input
            type="text"
            required
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 잔나비 - 주저하는 연인들을 위해"
            className="rounded-xl border border-[var(--border)] bg-white p-2.5 text-sm font-normal outline-none focus:border-[var(--brand-mid)] focus:ring-2 focus:ring-violet-200 transition-shadow"
          />
        </label>

        <StatusRadio value={status} onChange={setStatus} />

        <MembersInput value={members} onChange={setMembers} />

        <label className="flex flex-col gap-1 text-sm font-semibold">
          모집 글 (선택)
          <textarea
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={"예: 드럼, 베이스 구합니다!\n연습은 주 1회 예정이에요."}
            className="rounded-xl border border-[var(--border)] bg-white p-2.5 text-sm font-normal outline-none focus:border-[var(--brand-mid)] focus:ring-2 focus:ring-violet-200 transition-shadow"
          />
        </label>

        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl p-3 font-semibold text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.99] disabled:opacity-50"
          style={{ background: "var(--brand-gradient)" }}
        >
          {submitting ? "등록 중..." : "모집글 올리기"}
        </button>

        <p className="text-xs text-zinc-500">
          글을 올리면 예약 페이지의 팀 목록에 곡 제목이 바로 나타나요. 팀
          색상은 자동으로 정해집니다.
        </p>
      </form>
    </div>
  );
}
