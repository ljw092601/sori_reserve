"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DURATION_OPTIONS } from "@/lib/constants";
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
    if (!teamId) {
      setError("팀을 선택해주세요.");
      return;
    }
    setSubmitting(true);

    const res = await fetch(`/api/reservations/${reservationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
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
      className="mt-6 flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5"
    >
      <h2 className="font-semibold">예약 수정</h2>

      <div className="flex flex-col gap-1 text-sm font-medium">
        팀 (모집완료된 팀만)
        <TeamPicker teams={teams} value={teamId} onChange={setTeamId} />
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        날짜
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white p-2.5"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          시작 시간
          <input
            type="time"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white p-2.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          종료 시간
          <input
            type="time"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white p-2.5"
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
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:border-zinc-500 hover:bg-zinc-100 disabled:opacity-40"
          >
            {label}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        메모 (선택)
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="예: 정기합주, 공연연습"
          className="rounded-lg border border-zinc-300 bg-white p-2.5"
        />
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-zinc-900 p-3 font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {submitting ? "저장 중..." : "수정 저장"}
      </button>
    </form>
  );
}
