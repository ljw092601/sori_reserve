"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  DURATION_OPTIONS,
  RESERVATION_CATEGORIES,
  RULES,
  type ReservationCategory,
} from "@/lib/constants";
import { kstDateString, kstToIso } from "@/lib/dates";
import type { Team } from "@/lib/types";
import TeamPicker from "@/components/team-picker";

const fmtTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export default function ReserveForm({ teams }: { teams: Team[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [category, setCategory] = useState<ReservationCategory>("ensemble");
  const [teamId, setTeamId] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 주간 그리드에서 드래그해 넘어온 시간을 미리 채운다
  const [date, setDate] = useState(searchParams.get("date") ?? "");
  const [start, setStart] = useState(searchParams.get("start") ?? "");
  const [end, setEnd] = useState(searchParams.get("end") ?? "");

  /** 시작 시간 + n분 → 종료 시간 (자정 넘으면 23:59로 클램프) */
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
    if (category === "etc" && !title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          // 합주가 아니면 이전에 골랐던 팀이 남아 있어도 보내지 않는다
          teamId: category === "ensemble" ? teamId : undefined,
          // 제목은 기타에서만 입력받는다 — 합주는 팀명, 개인연습은 예약자 이름이 제목
          title: category === "etc" ? title : undefined,
          startsAt: kstToIso(date, start),
          endsAt: kstToIso(date, end),
          note: form.get("note"),
        }),
      });

      if (res.ok) {
        // 이동할 때까지 버튼은 비활성으로 둔다 (중복 제출 방지)
        router.push("/");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "예약에 실패했습니다.");
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
    setSubmitting(false);
  }

  const today = kstDateString(new Date());

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="mb-6 text-xl font-bold text-[var(--foreground)]">동아리방 예약</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* 목적 카테고리 */}
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

        {/* 팀 선택 — 합주일 때만 */}
        {category === "ensemble" && (
          <div className="flex flex-col gap-1 text-sm font-semibold">
            팀 (모집완료된 팀만)
            <TeamPicker teams={teams} value={teamId} onChange={setTeamId} />
            {teams.length === 0 && (
              <p className="text-xs font-normal text-zinc-500">
                모집완료된 팀이 아직 없어요.{" "}
                <Link href="/teams" className="text-[var(--brand-text)] underline">
                  팀 모집 게시판
                </Link>
                에서 팀을 완성해주세요.
              </p>
            )}
          </div>
        )}

        {/* 제목 — 기타일 때만 입력, 개인연습은 예약자 이름이 자동으로 제목이 된다 */}
        {category === "etc" && (
          <label className="flex flex-col gap-1 text-sm font-semibold">
            제목
            <input
              type="text"
              required
              maxLength={50}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 동아리 회의, 장비 점검"
              className="rounded-xl border border-[var(--border)] bg-white p-2.5 text-sm font-normal outline-none focus:border-[var(--brand-mid)] focus:ring-2 focus:ring-violet-200 transition-shadow"
            />
          </label>
        )}
        {category === "personal" && (
          <p className="-mt-2 text-xs text-zinc-500">
            개인연습은 내 이름이 제목으로 표시돼요.
          </p>
        )}

        {/* 날짜 */}
        <label className="flex flex-col gap-1 text-sm font-semibold">
          날짜
          <input
            type="date"
            name="date"
            required
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-white p-2.5 text-sm font-normal outline-none focus:border-[var(--brand-mid)] focus:ring-2 focus:ring-violet-200 transition-shadow"
          />
        </label>

        {/* 시간 */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            시작 시간
            <input
              type="time"
              name="start"
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
              name="end"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-xl border border-[var(--border)] bg-white p-2.5 text-sm font-normal outline-none focus:border-[var(--brand-mid)] focus:ring-2 focus:ring-violet-200 transition-shadow"
            />
          </label>
        </div>

        {/* 시간 퀵-선택 칩 */}
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

        {/* 메모 */}
        <label className="flex flex-col gap-1 text-sm font-semibold">
          메모 (선택)
          <input
            type="text"
            name="note"
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
