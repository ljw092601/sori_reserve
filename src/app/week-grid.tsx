"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CATEGORY_COLORS,
  CATEGORY_LABEL,
  DAY_START_HOUR,
  DAY_END_HOUR,
  TIME_ZONE,
} from "@/lib/constants";
import { dayStartEpoch } from "@/lib/dates";
import type { Reservation } from "@/lib/types";

const HOUR_PX = 48;
const DRAG_SNAP_MIN = 15; // 드래그 스냅 (폼에서 분 단위로 수정 가능)
const TAP_SNAP_MIN = 30; // 모바일 탭 스냅
const TOTAL_MIN = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const COL_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_PX;
const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => DAY_START_HOUR + i
);
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

/** 자정 기준 분 → "HH:mm" */
const fmtTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

const isoTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ko-KR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const weekdayOf = (day: string) =>
  WEEKDAYS[new Date(day + "T00:00:00Z").getUTCDay()];

type Drag = { day: number; y0: number; y1: number };
/** 드래그/탭으로 고른 시간 — 예약하기 버튼을 누르기 전까지 유지 */
type Sel = { day: number; m0: number; m1: number };

/** 드래그 픽셀 범위 → 스냅된 [시작분, 끝분] (그리드 시작 기준) */
function snapRange(drag: Drag): [number, number] {
  const toMin = (y: number) =>
    clamp(
      Math.round(((y / HOUR_PX) * 60) / DRAG_SNAP_MIN) * DRAG_SNAP_MIN,
      0,
      TOTAL_MIN
    );
  let m0 = toMin(Math.min(drag.y0, drag.y1));
  let m1 = toMin(Math.max(drag.y0, drag.y1));
  if (m1 - m0 < 30) m1 = Math.min(m0 + 60, TOTAL_MIN); // 클릭이면 1시간
  if (m1 - m0 < 30) m0 = Math.max(m1 - 60, 0); // 그리드 바닥 근처
  return [m0, m1];
}

export default function WeekGrid({
  days,
  today,
  reservations,
}: {
  days: string[];
  today: string;
  reservations: Reservation[];
}) {
  const router = useRouter();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [sel, setSel] = useState<Sel | null>(null);
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dayColRef = useRef<HTMLDivElement | null>(null);

  // 모바일 일간 뷰에서 보고 있는 요일 (기본: 오늘, 다른 주면 월요일)
  const [selected, setSelected] = useState(() => {
    const i = days.indexOf(today);
    return i >= 0 ? i : 0;
  });

  // 주가 바뀌면 이전 주에서 고른 시간은 무효
  useEffect(() => {
    setSel(null);
  }, [days]);

  // 예약을 날짜별 블록(top/height px)으로 변환. 표시 범위 밖은 잘라낸다.
  const blocksByDay = days.map((day) => {
    const visStart = dayStartEpoch(day) + DAY_START_HOUR * 3_600_000;
    const visEnd = dayStartEpoch(day) + DAY_END_HOUR * 3_600_000;
    return reservations.flatMap((r) => {
      const s = Math.max(Date.parse(r.starts_at), visStart);
      const e = Math.min(Date.parse(r.ends_at), visEnd);
      if (e <= s) return [];
      return [
        {
          r,
          top: ((s - visStart) / 3_600_000) * HOUR_PX,
          height: ((e - s) / 3_600_000) * HOUR_PX,
        },
      ];
    });
  });

  function pushReserve(dayIdx: number, m0: number, m1: number) {
    const start = fmtTime(DAY_START_HOUR * 60 + m0);
    const end = fmtTime(Math.min(DAY_START_HOUR * 60 + m1, 1439)); // 24:00 → 23:59
    router.push(`/reserve?date=${days[dayIdx]}&start=${start}&end=${end}`);
  }

  const colY = (day: number, clientY: number) => {
    const rect = colRefs.current[day]!.getBoundingClientRect();
    return clamp(clientY - rect.top, 0, COL_HEIGHT);
  };

  function finishDrag() {
    if (!drag) return;
    const [m0, m1] = snapRange(drag);
    setDrag(null);
    setSel({ day: drag.day, m0, m1 }); // 바로 이동하지 않고 예약하기 버튼을 띄운다
  }

  /** 모바일: 빈 시간 탭 → 30분 스냅 위치부터 1시간 선택 (버튼으로 확정) */
  function handleDayTap(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("a, button")) return;
    const rect = dayColRef.current!.getBoundingClientRect();
    const y = clamp(e.clientY - rect.top, 0, COL_HEIGHT);
    const m0 = clamp(
      Math.round(((y / HOUR_PX) * 60) / TAP_SNAP_MIN) * TAP_SNAP_MIN,
      0,
      TOTAL_MIN - 30
    );
    setSel({ day: selected, m0, m1: Math.min(m0 + 60, TOTAL_MIN) });
  }

  /** 고른 시간 표시 + 예약하기 버튼 (데스크톱/모바일 공용) */
  const renderSelection = (dayIdx: number) => {
    if (!sel || sel.day !== dayIdx || drag) return null;
    const top = (sel.m0 / 60) * HOUR_PX;
    const height = Math.max(((sel.m1 - sel.m0) / 60) * HOUR_PX, 4);
    const buttonBelow = top + height + 44 <= COL_HEIGHT;
    return (
      <div
        className="pointer-events-none absolute inset-x-0.5 z-30"
        style={{ top, height }}
      >
        <div className="absolute inset-0 rounded-lg border-2 border-[var(--brand-mid)] bg-violet-300/30 px-1.5 text-[10px] font-semibold text-[var(--brand-text)] md:text-[12px]">
          {fmtTime(DAY_START_HOUR * 60 + sel.m0)}~
          {fmtTime(DAY_START_HOUR * 60 + sel.m1)}
        </div>
        <div
          className={`absolute inset-x-0 flex justify-center ${
            buttonBelow ? "top-full mt-1.5" : "bottom-full mb-1.5"
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              pushReserve(sel.day, sel.m0, sel.m1);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="pointer-events-auto whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white shadow-md transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "var(--brand-gradient)" }}
          >
            예약하기
          </button>
        </div>
      </div>
    );
  };

  const renderBlocks = (dayIdx: number) =>
    blocksByDay[dayIdx].map(({ r, top, height }) => (
      <Link
        key={r.id}
        href={`/reservations/${r.id}`}
        draggable={false}
        className="absolute inset-x-0.5 z-10 overflow-hidden rounded-lg px-2 py-1 text-[11px] leading-tight text-white shadow-md transition-opacity hover:opacity-80 md:text-[13px]"
        style={{
          top,
          height,
          // 합주는 팀 색, 개인연습/기타는 카테고리 고정 색
          backgroundColor: r.team?.color ?? CATEGORY_COLORS[r.category],
        }}
      >
        <span className="font-semibold">
          {/* 팀 없는 예약은 "개인연습 · 홍길동"처럼 목적과 예약자를 보여준다 */}
          {r.team?.name ?? `${CATEGORY_LABEL[r.category]} · ${r.created_by_name}`}
        </span>{" "}
        {isoTime(r.starts_at)}~{isoTime(r.ends_at)}
        {r.note && <span className="opacity-80"> · {r.note}</span>}
      </Link>
    ));

  const hourRows = HOURS.map((h) => (
    // 높이는 HOUR_PX 고정 — rem(h-12)을 쓰면 데스크톱 글자 확대 시 드래그 계산과 어긋난다
    <div
      key={h}
      className="border-b border-[var(--border)]"
      style={{ height: HOUR_PX }}
    />
  ));

  const timeLabels = HOURS.map((h) => (
    <div
      key={h}
      className="pr-2 pt-0.5 text-right text-[10px] text-zinc-400 font-medium md:text-[12px]"
      style={{ height: HOUR_PX }}
    >
      {h}:00
    </div>
  ));

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white shadow-md overflow-hidden">
      {/* ── 모바일: 요일 탭 + 일간 뷰 ───────────────────────── */}
      <div className="md:hidden">
        {/* 요일 탭 바 */}
        <div className="flex border-b border-[var(--border)] bg-[var(--surface-raised)]">
          {days.map((day, i) => {
            const isToday = day === today;
            const isSelected = i === selected;
            return (
              <button
                key={day}
                onClick={() => setSelected(i)}
                className={`flex flex-1 flex-col items-center py-2.5 text-xs transition-colors ${
                  isSelected
                    ? "border-b-2 border-[var(--brand-mid)] font-bold text-[var(--brand-mid)] bg-white"
                    : isToday
                      ? "font-semibold text-[var(--brand-text)]"
                      : "text-zinc-400"
                }`}
              >
                <span className="text-[11px]">{weekdayOf(day)}</span>
                <span
                  className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold leading-none ${
                    isSelected
                      ? "bg-[var(--brand-mid)] text-white"
                      : isToday
                        ? "text-[var(--brand-mid)]"
                        : ""
                  }`}
                >
                  {+day.slice(8, 10)}
                </span>
              </button>
            );
          })}
        </div>

        {/* 일간 타임그리드 */}
        <div className="grid grid-cols-[2.5rem_1fr]">
          <div>{timeLabels}</div>
          <div
            ref={dayColRef}
            className={`relative border-l border-[var(--border)] ${
              days[selected] === today ? "bg-violet-50/60" : ""
            }`}
            style={{ height: COL_HEIGHT }}
            onClick={handleDayTap}
          >
            {hourRows}
            {renderBlocks(selected)}
            {renderSelection(selected)}
          </div>
        </div>
        <p className="border-t border-[var(--border)] px-3 py-2.5 text-xs text-zinc-400">
          빈 시간을 탭해 시간을 고른 뒤 예약하기 버튼을 누르세요. 예약 블록을
          누르면 상세 화면으로 이동합니다.
        </p>
      </div>

      {/* ── 데스크톱: 주간 뷰 ─────────────────────────────── */}
      <div
        className="week-scroll hidden select-none overflow-x-auto md:block"
        onMouseMove={(e) =>
          drag && setDrag({ ...drag, y1: colY(drag.day, e.clientY) })
        }
        onMouseUp={finishDrag}
        onMouseLeave={() => setDrag(null)}
      >
        <div className="min-w-[760px]">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-[3rem_repeat(7,1fr)] border-b border-[var(--border)] bg-[var(--surface-raised)]">
            <div />
            {days.map((day) => {
              const isToday = day === today;
              return (
                <div
                  key={day}
                  className={`py-3 text-center text-sm font-semibold ${
                    isToday
                      ? "text-[var(--brand-mid)]"
                      : "text-zinc-500"
                  }`}
                >
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                      isToday ? "bg-[var(--brand-soft)]" : ""
                    }`}
                  >
                    {+day.slice(5, 7)}/{+day.slice(8, 10)} ({weekdayOf(day)})
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-[3rem_repeat(7,1fr)]">
            {/* 시간 라벨 */}
            <div>{timeLabels}</div>

            {/* 날짜 컬럼 */}
            {days.map((day, i) => (
              <div
                key={day}
                ref={(el) => {
                  colRefs.current[i] = el;
                }}
                className={`relative cursor-crosshair border-l border-[var(--border)] ${
                  day === today ? "bg-violet-50/50" : ""
                }`}
                style={{ height: COL_HEIGHT }}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  if ((e.target as HTMLElement).closest("a, button")) return;
                  e.preventDefault();
                  setSel(null); // 새로 드래그하면 이전 선택은 버린다
                  const y = colY(i, e.clientY);
                  setDrag({ day: i, y0: y, y1: y });
                }}
              >
                {hourRows}
                {renderBlocks(i)}

                {/* 드래그 선택 표시 */}
                {drag?.day === i &&
                  (() => {
                    const [m0, m1] = snapRange(drag);
                    return (
                      <div
                        className="pointer-events-none absolute inset-x-0.5 z-20 rounded-lg border border-[var(--brand-mid)] bg-violet-300/30 px-1.5 text-[10px] font-semibold text-[var(--brand-text)]"
                        style={{
                          top: (m0 / 60) * HOUR_PX,
                          height: Math.max(((m1 - m0) / 60) * HOUR_PX, 4),
                        }}
                      >
                        {fmtTime(DAY_START_HOUR * 60 + m0)}~
                        {fmtTime(DAY_START_HOUR * 60 + m1)}
                      </div>
                    );
                  })()}

                {/* 확정 대기 중인 선택 + 예약하기 버튼 */}
                {renderSelection(i)}
              </div>
            ))}
          </div>
        </div>
        <p className="border-t border-[var(--border)] px-3 py-2.5 text-xs text-zinc-400">
          빈 시간을 드래그(또는 클릭)해 시간을 고른 뒤 예약하기 버튼을
          누르세요. 예약 블록을 누르면 상세/취소 화면으로 이동합니다.
        </p>
      </div>
    </div>
  );
}
