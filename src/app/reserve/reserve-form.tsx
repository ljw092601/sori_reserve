"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DURATION_OPTIONS, RULES } from "@/lib/constants";
import { kstDateString, kstToIso } from "@/lib/dates";
import type { Team } from "@/lib/types";
import TeamPicker from "@/components/team-picker";

const fmtTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export default function ReserveForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 주간 그리드에서 드래그해 넘어온 시간을 미리 채운다
  const [date, setDate] = useState(searchParams.get("date") ?? "");
  const [start, setStart] = useState(searchParams.get("start") ?? "");
  const [end, setEnd] = useState(searchParams.get("end") ?? "");
  const [repeatWeeks, setRepeatWeeks] = useState(1);

  useEffect(() => {
    // 모집이 끝난 팀만 예약할 수 있다
    fetch("/api/teams?status=closed")
      .then((res) => res.json())
      .then((data) => setTeams(data.teams ?? []))
      .catch(() => setError("팀 목록을 불러오지 못했습니다."));
  }, []);

  /** 시작 시간 + n분 → 종료 시간 (자정 넘으면 23:59로 클램프) */
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

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        startsAt: kstToIso(date, start),
        endsAt: kstToIso(date, end),
        note: form.get("note"),
        repeatWeeks,
      }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => null);
    setError(data?.error ?? "예약에 실패했습니다.");
    setSubmitting(false);
  }

  const today = kstDateString(new Date());

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="mb-6 text-xl font-bold">동아리방 예약</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 text-sm font-medium">
          팀 (모집완료된 팀만)
          <TeamPicker teams={teams} value={teamId} onChange={setTeamId} />
          {teams.length === 0 && (
            <p className="text-xs font-normal text-zinc-500">
              모집완료된 팀이 아직 없어요.{" "}
              <Link href="/teams" className="underline">
                팀 모집 게시판
              </Link>
              에서 팀을 완성해주세요.
            </p>
          )}
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium">
          날짜
          <input
            type="date"
            name="date"
            required
            min={today}
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
              name="start"
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
              name="end"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white p-2.5"
            />
          </label>
        </div>

        {/* 시작 시간 기준으로 종료 시간을 빠르게 지정 */}
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
          매주 반복
          <select
            value={repeatWeeks}
            onChange={(e) => setRepeatWeeks(Number(e.target.value))}
            className="rounded-lg border border-zinc-300 bg-white p-2.5"
          >
            <option value={1}>반복 안 함</option>
            {Array.from(
              { length: RULES.MAX_REPEAT_WEEKS - 1 },
              (_, i) => i + 2
            ).map((n) => (
              <option key={n} value={n}>
                {n}주 동안 (총 {n}회)
              </option>
            ))}
          </select>
          {repeatWeeks > 1 && (
            <span className="text-xs font-normal text-zinc-500">
              같은 요일·시간으로 {repeatWeeks}주간 예약돼요. 한 주라도 겹치면
              전체가 등록되지 않아요.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          메모 (선택)
          <input
            type="text"
            name="note"
            placeholder="예: 정기합주, 공연연습"
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
          {submitting ? "예약 중..." : "예약하기"}
        </button>

        <p className="text-xs text-zinc-500">
          {RULES.MIN_MINUTES}분 이상 {RULES.MAX_MINUTES / 60}시간 이하로
          예약할 수 있어요. (오늘부터 {RULES.MAX_DAYS_AHEAD}일 후까지)
        </p>
      </form>
    </div>
  );
}
