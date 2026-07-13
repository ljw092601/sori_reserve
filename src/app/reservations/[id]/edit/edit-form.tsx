"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  DURATION_OPTIONS,
  RESERVATION_CATEGORIES,
  type ReservationCategory,
} from "@/lib/constants";
import { kstToIso } from "@/lib/dates";
import type { Team } from "@/lib/types";
import TeamPicker from "@/components/team-picker";

const fmtTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export default function EditForm({
  reservationId,
  initial,
}: {
  reservationId: string;
  initial: {
    category: ReservationCategory;
    teamId: string;
    date: string;
    start: string;
    end: string;
    note: string;
  };
}) {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [category, setCategory] = useState(initial.category);
  const [teamId, setTeamId] = useState(initial.teamId);
  const [date, setDate] = useState(initial.date);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [note, setNote] = useState(initial.note);

  useEffect(() => {
    // 모집완료된 팀 + 이 예약의 현재 팀(모집중이어도 유지)만 선택 가능
    fetch("/api/teams")
      .then((res) => res.json())
      .then((data) => {
        const all = (data.teams ?? []) as Team[];
        setTeams(
          all.filter(
            (t) => t.status === "closed" || t.id === initial.teamId
          )
        );
      })
      .catch(() => setError("팀 목록을 불러오지 못했습니다."));
  }, [initial.teamId]);

  function applyDuration(min: number) {
    if (!start) return;
    const [h, m] = start.split(":").map(Number);
    setEnd(fmtTime(Math.min(h * 60 + m + min, 1439)));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (category === "ensemble" && !teamId) {
      setError("팀을 선택해주세요.");
      return;
    }
    setSubmitting(true);

    const res = await fetch(`/api/reservations/${reservationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        // 합주가 아니면 이전에 골랐던 팀이 남아 있어도 보내지 않는다
        teamId: category === "ensemble" ? teamId : undefined,
        startsAt: kstToIso(date, start),
        endsAt: kstToIso(date, end),
        note,
      }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => null);
    setError(data?.error ?? "수정에 실패했습니다.");
    setSubmitting(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm"
    >
      <h2 className="font-bold text-[var(--foreground)]">예약 수정</h2>

      <div className="flex flex-col gap-1 text-sm font-semibold">
        목적
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--border)] bg-white p-1">
          {RESERVATION_CATEGORIES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                category === value
                  ? "bg-[var(--brand-mid)] text-white shadow-sm"
                  : "text-zinc-500 hover:bg-[var(--brand-soft)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {category === "ensemble" && (
        <div className="flex flex-col gap-1 text-sm font-semibold">
          팀 (모집완료된 팀만)
          <TeamPicker teams={teams} value={teamId} onChange={setTeamId} />
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm font-semibold">
        날짜
        <input
          type="date"
          required
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

      <div className="flex flex-wrap gap-1.5">
        {DURATION_OPTIONS.map(({ label, min }) => (
          <button
            key={min}
            type="button"
            onClick={() => applyDuration(min)}
            disabled={!start}
            className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium text-[var(--brand-text)] hover:border-[var(--brand-mid)] hover:bg-[var(--brand-soft)] transition-colors disabled:opacity-40"
          >
            {label}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm font-semibold">
        메모 (선택)
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="예: 정기합주, 공연연습"
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
  );
}
