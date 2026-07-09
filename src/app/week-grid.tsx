"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DAY_START_HOUR, DAY_END_HOUR, TIME_ZONE } from "@/lib/constants";
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
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dayColRef = useRef<HTMLDivElement | null>(null);

  // 모바일 일간 뷰에서 보고 있는 요일 (기본: 오늘, 다른 주면 월요일)
  const [selected, setSelected] = useState(() => {
    const i = days.indexOf(today);
    return i >= 0 ? i : 0;
  });

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
    pushReserve(drag.day, m0, m1);
  }

  /** 모바일: 빈 시간 탭 → 30분 스냅 위치부터 1시간 예약 폼으로 */
  function handleDayTap(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("a")) return;
    const rect = dayColRef.current!.getBoundingClientRect();
    const y = clamp(e.clientY - rect.top, 0, COL_HEIGHT);
    const m0 = clamp(
      Math.round(((y / HOUR_PX) * 60) / TAP_SNAP_MIN) * TAP_SNAP_MIN,
      0,
      TOTAL_MIN - 30
    );
    pushReserve(selected, m0, Math.min(m0 + 60, TOTAL_MIN));
  }

  const renderBlocks = (dayIdx: number) =>
    blocksByDay[dayIdx].map(({ r, top, height }) => (
      <Link
        key={r.id}
        href={`/reservations/${r.id}`}
        draggable={false}
        className="absolute inset-x-0.5 z-10 overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] leading-tight text-white hover:opacity-90"
        style={{ top, height, backgroundColor: r.team?.color ?? "#71717a" }}
      >
        <span className="font-semibold">{r.team?.name}</span>{" "}
        {isoTime(r.starts_at)}~{isoTime(r.ends_at)}
        {r.note && <span className="opacity-80"> · {r.note}</span>}
      </Link>
    ));

  const hourRows = HOURS.map((h) => (
    <div key={h} className="h-12 border-b border-zinc-100" />
  ));

  const timeLabels = HOURS.map((h) => (
    <div
      key={h}
      className="h-12 pr-1.5 pt-0.5 text-right text-[10px] text-zinc-400"
    >
      {h}:00
    </div>
  ));

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      {/* ── 모바일: 요일 탭 + 일간 뷰 ───────────────────────── */}
      <div className="md:hidden">
        <div className="flex border-b border-zinc-200">
          {days.map((day, i) => (
            <button
              key={day}
              onClick={() => setSelected(i)}
              className={`flex-1 flex-col py-2 text-center text-xs ${
                i === selected
                  ? "border-b-2 border-indigo-600 font-bold text-indigo-600"
                  : day === today
                    ? "font-semibold text-indigo-500"
                    : "text-zinc-500"
              }`}
            >
              <div>{weekdayOf(day)}</div>
              <div className="text-sm">{+day.slice(8, 10)}</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[2.5rem_1fr]">
          <div>{timeLabels}</div>
          <div
            ref={dayColRef}
            className={`relative border-l border-zinc-100 ${
              days[selected] === today ? "bg-indigo-50/40" : ""
            }`}
            style={{ height: COL_HEIGHT }}
            onClick={handleDayTap}
          >
            {hourRows}
            {renderBlocks(selected)}
          </div>
        </div>
        <p className="border-t border-zinc-100 px-3 py-2 text-xs text-zinc-400">
          빈 시간을 탭하면 그 시간으로 예약 화면이 열립니다. 예약 블록을 누르면
          상세 화면으로 이동합니다.
        </p>
      </div>

      {/* ── 데스크톱: 주간 뷰 ─────────────────────────────── */}
      <div
        className="hidden select-none overflow-x-auto md:block"
        onMouseMove={(e) =>
          drag && setDrag({ ...drag, y1: colY(drag.day, e.clientY) })
        }
        onMouseUp={finishDrag}
        onMouseLeave={() => setDrag(null)}
      >
        <div className="min-w-[760px]">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-[3rem_repeat(7,1fr)] border-b border-zinc-200">
            <div />
            {days.map((day) => (
              <div
                key={day}
                className={`py-2 text-center text-sm ${
                  day === today ? "font-bold text-indigo-600" : "text-zinc-600"
                }`}
              >
                {+day.slice(5, 7)}/{+day.slice(8, 10)} ({weekdayOf(day)})
              </div>
            ))}
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
                className={`relative cursor-crosshair border-l border-zinc-100 ${
                  day === today ? "bg-indigo-50/40" : ""
                }`}
                style={{ height: COL_HEIGHT }}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  if ((e.target as HTMLElement).closest("a")) return;
                  e.preventDefault();
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
                        className="pointer-events-none absolute inset-x-0.5 z-20 rounded-md border border-indigo-400 bg-indigo-300/40 px-1.5 text-[10px] font-medium text-indigo-800"
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
              </div>
            ))}
          </div>
        </div>
        <p className="border-t border-zinc-100 px-3 py-2 text-xs text-zinc-400">
          빈 시간을 드래그(또는 클릭)하면 그 시간으로 예약 화면이 열립니다.
          예약 블록을 누르면 상세/취소 화면으로 이동합니다.
        </p>
      </div>
    </div>
  );
}
