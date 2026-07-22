"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SONG_URL_MAX, TEAM_CONTENT_MAX } from "@/lib/constants";
import type { MemberEntry } from "@/lib/types";
import { MembersInput, StatusRadio } from "../../form-fields";

export default function EditForm({
  teamId,
  initial,
}: {
  teamId: string;
  initial: {
    name: string;
    status: "recruiting" | "closed";
    members: MemberEntry[];
    content: string;
    songUrl: string;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState(initial.name);
  const [status, setStatus] = useState<"recruiting" | "closed">(
    initial.status
  );
  const [members, setMembers] = useState<MemberEntry[]>(
    initial.members.length > 0 ? initial.members : [{ session: "", name: "" }]
  );
  const [content, setContent] = useState(initial.content);
  const [songUrl, setSongUrl] = useState(initial.songUrl);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch(`/api/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, status, members, content, song_url: songUrl }),
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
      <h1 className="mb-6 text-xl font-bold text-[var(--foreground)]">모집글 수정</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          곡 제목
          <input
            type="text"
            required
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-white p-2.5 text-sm font-normal outline-none focus:border-[var(--brand-mid)] focus:ring-2 focus:ring-violet-200 transition-shadow"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold">
          곡 링크 (선택)
          <input
            type="url"
            maxLength={SONG_URL_MAX}
            value={songUrl}
            onChange={(e) => setSongUrl(e.target.value)}
            placeholder="예: https://youtu.be/..."
            className="rounded-xl border border-[var(--border)] bg-white p-2.5 text-sm font-normal outline-none focus:border-[var(--brand-mid)] focus:ring-2 focus:ring-violet-200 transition-shadow"
          />
          <span className="text-xs font-normal text-zinc-400">
            유튜브 링크를 넣으면 모집글에서 바로 들어볼 수 있어요.
          </span>
        </label>

        <StatusRadio value={status} onChange={setStatus} />

        <MembersInput value={members} onChange={setMembers} />

        <label className="flex flex-col gap-1 text-sm font-semibold">
          모집 글 (선택)
          <textarea
            rows={5}
            maxLength={TEAM_CONTENT_MAX}
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
          {submitting ? "저장 중..." : "수정 저장"}
        </button>
      </form>
    </div>
  );
}
