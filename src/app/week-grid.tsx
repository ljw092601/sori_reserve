"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CATEGORY_COLORS,
  DAY_START_HOUR,
  DAY_END_HOUR,
  reservationTitle,
} from "@/lib/constants";
import { dayStartEpoch } from "@/lib/dates";
import type { BlockRule } from "@/lib/block-rules";
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
  blockRules,
}: {
  days: string[];
  today: string;
  reservations: Reservation[];
  blockRules: BlockRule[];
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

  // 정기 사용 금지 규칙을 요일별 띠(top/height px)로 변환. 표시 범위 밖은 잘라낸다.
  const ruleBandsByDay = days.map((day) => {
    const dow = new Date(day + "T00:00:00Z").getUTCDay();
    return blockRules.flatMap((rule) => {
      const s = Math.max(rule.start_min, DAY_START_HOUR * 60);
      const e = Math.min(rule.end_min, DAY_END_HOUR * 60);
      if (rule.day_of_week !== dow || e <= s) return [];
      return [
        {
          rule,
          top: ((s - DAY_START_HOUR * 60) / 60) * HOUR_PX,
          height: ((e - s) / 60) * HOUR_PX,
        },
      ];
    });
  });

  // 예약을 날짜별 블록(top/height px)으로 변환. 표시 범위 밖은 잘라내고,
  // 정기 사용 금지 규칙과 겹치는 부분은 규칙이 우선하도록 빼고 그린다 —
  // 규칙 도입 전에 잡힌 예약은 남은 시간대만 보인다. (DB의 예약 시간은
  // 그대로라 규칙을 수정/삭제하면 표시도 원래대로 돌아온다)
  const blocksByDay = days.map((day) => {
    const dayStart = dayStartEpoch(day);
    const visStart = dayStart + DAY_START_HOUR * 3_600_000;
    const visEnd = dayStart + DAY_END_HOUR * 3_600_000;
    const dow = new Date(day + "T00:00:00Z").getUTCDay();
    const ruleSpans = blockRules
      .filter((rule) => rule.day_of_week === dow)
      .map((rule) => ({
        s: dayStart + rule.start_min * 60_000,
        e: dayStart + rule.end_min * 60_000,
      }));
    return reservations.flatMap((r) => {
      // 규칙 구간을 하나씩 빼면서 남는 조각들 (중간이 가리면 앞뒤 두 조각)
      let segs = [
        {
          s: Math.max(Date.parse(r.starts_at), visStart),
          e: Math.min(Date.parse(r.ends_at), visEnd),
        },
      ];
      for (const span of ruleSpans) {
        segs = segs.flatMap(({ s, e }) => {
          const pieces = [];
          if (s < span.s) pieces.push({ s, e: Math.min(e, span.s) });
          if (e > span.e) pieces.push({ s: Math.max(s, span.e), e });
          return pieces;
        });
      }
      return segs
        .filter(({ s, e }) => e > s)
        .map(({ s, e }) => ({
          r,
          // 한 예약이 여러 조각으로 갈라질 수 있어 id만으로는 key가 안 된다
          key: `${r.id}:${s}`,
          // 시간 표기도 잘린 조각 기준 — "13~15시 금지"에 걸린 14~17시 예약은 15:00~17:00으로 보인다
          label: `${fmtTime(Math.round((s - dayStart) / 60_000))}~${fmtTime(Math.round((e - dayStart) / 60_000))}`,
          top: ((s - visStart) / 3_600_000) * HOUR_PX,
          height: ((e - s) / 3_600_000) * HOUR_PX,
        }));
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

  /** 정기 사용 금지 띠 — 클릭 대상이 아니라 안내용이라 포인터 이벤트를 받지 않는다 */
  const renderRuleBands = (dayIdx: number) =>
    ruleBandsByDay[dayIdx].map(({ rule, top, height }) => (
      <div
        key={rule.id}
        className="pointer-events-none absolute inset-x-0.5 z-0 overflow-hidden rounded-lg px-2 py-1 text-[11px] leading-tight text-zinc-500 md:text-[13px]"
        style={{
          top,
          height,
          background:
            "repeating-linear-gradient(135deg, #e4e4e7 0 8px, #f4f4f5 8px 16px)",
        }}
      >
        <span className="font-semibold">사용 금지</span>{" "}
        {fmtTime(rule.start_min)}~{fmtTime(rule.end_min)}
        {rule.note && <span className="opacity-80"> · {rule.note}</span>}
      </div>
    ));

  const renderBlocks = (dayIdx: number) =>
    blocksByDay[dayIdx].map(({ r, key, label, top, height }) => (
      <Link
        key={key}
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
          {/* 합주는 팀명, 개인연습은 예약자 이름, 기타는 입력한 제목 */}
          {reservationTitle(r)}
        </span>{" "}
        {label}
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
            {renderRuleBands(selected)}
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
                {renderRuleBands(i)}
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
