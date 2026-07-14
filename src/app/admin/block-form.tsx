"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { isAdminBlockTeam } from "@/lib/constants";
import { kstDateString, kstToIso } from "@/lib/dates";
import type { Team } from "@/lib/types";

/**
 * 특정 날짜 사용 금지 등록 폼 (임원 전용).
 * "사용금지" 팀으로 예약을 만들어 해당 시간대를 통째로 막는다.
 * (매주 반복되는 금지는 정기 사용 금지 규칙 섹션에서 관리한다)
 */
export default function BlockForm() {
  const router = useRouter();
  const [blockTeams, setBlockTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  useEffect(() => {
    fetch("/api/teams")
      .then((res) => res.json())
      .then((data) => {
        const blocks = (data.teams ?? []).filter((t: Team) =>
          isAdminBlockTeam(t.name)
        );
        setBlockTeams(blocks);
        // 보통 사용금지 팀은 하나라서 자동 선택된다
        if (blocks.length > 0) setTeamId(blocks[0].id);
      })
      .catch(() => setError("팀 목록을 불러오지 못했습니다."))
      .finally(() => setLoaded(true));
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        startsAt: kstToIso(date, start),
        endsAt: kstToIso(date, end),
        note: form.get("note"),
      }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => null);
    setError(data?.error ?? "등록에 실패했습니다.");
    setSubmitting(false);
  }

  if (loaded && blockTeams.length === 0) {
    return (
      <p className="rounded-2xl border border-[var(--border)] bg-white p-6 text-sm text-zinc-500 shadow-md">
        이름에 &ldquo;사용 금지&rdquo;가 들어간 팀이 없어요. Supabase
        대시보드에서 사용 금지용 팀을 먼저 만들어주세요.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-md"
    >
      <div>
        <h2 className="text-base font-bold text-[var(--foreground)]">
          특정 날짜 사용 금지
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          하루짜리 일정(대청소, 행사 등)으로 특정 시간대를 막아요. 매주
          반복되는 금지는 위의 정기 사용 금지에서 등록해주세요.
        </p>
      </div>

      {/* 사용금지 팀이 여러 개일 때만 선택지를 보여준다 */}
      {blockTeams.length > 1 && (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          구분
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-white p-2.5 text-sm font-normal outline-none focus:border-[var(--brand-mid)] focus:ring-2 focus:ring-violet-200 transition-shadow"
          >
            {blockTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm font-semibold">
        날짜
        <input
          type="date"
          required
          min={kstDateString(new Date())}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-white p-2.5 text-sm font-normal outline-none focus:border-[var(--brand-mid)] focus:ring-2 focus:ring-violet-200 transition-shadow"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          시작 시간
          <input
            type="time"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-white p-2.5 text-sm font-normal outline-none focus:border-[var(--brand-mid)] focus:ring-2 focus:ring-violet-200 transition-shadow"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          종료 시간
          <input
            type="time"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-white p-2.5 text-sm font-normal outline-none focus:border-[var(--brand-mid)] focus:ring-2 focus:ring-violet-200 transition-shadow"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-semibold">
        메모 (선택)
        <input
          type="text"
          name="note"
          placeholder="예: 대청소, 정기공연 리허설"
          className="rounded-xl border border-[var(--border)] bg-white p-2.5 text-sm font-normal outline-none focus:border-[var(--brand-mid)] focus:ring-2 focus:ring-violet-200 transition-shadow"
        />
      </label>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !teamId}
        className="rounded-xl p-3 font-semibold text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.99] disabled:opacity-50"
        style={{ background: "var(--brand-gradient)" }}
      >
        {submitting ? "등록 중..." : "사용 금지 등록"}
      </button>
    </form>
  );
}
