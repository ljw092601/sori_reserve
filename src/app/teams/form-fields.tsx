"use client";

import { useState } from "react";
import { SESSION_PRESETS, TEAM_STATUS_LABEL } from "@/lib/constants";
import type { MemberEntry } from "@/lib/types";

/** 모집중/모집완료 선택 (생성·수정 폼 공용) */
export function StatusRadio({
  value,
  onChange,
}: {
  value: "recruiting" | "closed";
  onChange: (v: "recruiting" | "closed") => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1 text-sm font-semibold">
      <legend className="mb-1">모집 상태</legend>
      <div className="flex gap-2">
        {(["recruiting", "closed"] as const).map((s) => (
          <label
            key={s}
            className={`flex-1 cursor-pointer rounded-xl border p-2.5 text-center text-sm font-semibold transition-all ${
              value === s
                ? "border-transparent text-white shadow-md"
                : "border-[var(--border)] bg-white text-zinc-600 hover:border-[var(--brand-mid)] hover:text-[var(--brand-text)]"
            }`}
            style={
              value === s
                ? { background: "var(--brand-gradient)" }
                : undefined
            }
          >
            <input
              type="radio"
              name="status"
              value={s}
              checked={value === s}
              onChange={() => onChange(s)}
              className="sr-only"
            />
            {TEAM_STATUS_LABEL[s]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const CUSTOM = "__custom__";

/** 팀원 한 줄 — 세션은 선택 박스, "직접 입력" 선택 시 입력칸이 나타난다 */
function MemberRow({
  row,
  onUpdate,
  onRemove,
}: {
  row: MemberEntry;
  onUpdate: (patch: Partial<MemberEntry>) => void;
  onRemove: () => void;
}) {
  // 기존 값이 선택지에 없으면 직접 입력 모드로 시작 (수정 폼에서 불러온 경우)
  const [custom, setCustom] = useState(
    row.session !== "" &&
      !(SESSION_PRESETS as readonly string[]).includes(row.session)
  );

  function handleSelect(v: string) {
    if (v === CUSTOM) {
      setCustom(true);
      onUpdate({ session: "" });
    } else {
      setCustom(false);
      onUpdate({ session: v });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <select
          value={custom ? CUSTOM : row.session}
          onChange={(e) => handleSelect(e.target.value)}
          className="w-0 flex-1 rounded-xl border border-[var(--border)] bg-white p-2.5 text-sm outline-none focus:border-[var(--brand-mid)] focus:ring-2 focus:ring-violet-200 transition-shadow"
        >
          <option value="">세션 선택</option>
          {SESSION_PRESETS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value={CUSTOM}>직접 입력</option>
        </select>
        <input
          type="text"
          value={row.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          maxLength={20}
          placeholder="이름 (비우면 모집중)"
          className="w-0 flex-1 rounded-xl border border-[var(--border)] bg-white p-2.5 text-sm outline-none focus:border-[var(--brand-mid)] focus:ring-2 focus:ring-violet-200 transition-shadow"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="팀원 줄 삭제"
          className="shrink-0 rounded-xl border border-[var(--border)] px-3 py-2.5 text-zinc-400 hover:border-red-300 hover:text-red-500 transition-colors"
        >
          ✕
        </button>
      </div>
      {custom && (
        <input
          type="text"
          value={row.session}
          onChange={(e) => onUpdate({ session: e.target.value })}
          maxLength={20}
          placeholder="세션 직접 입력 (예: 퍼커션)"
          className="rounded-xl border border-[var(--border)] bg-white p-2.5 text-sm outline-none focus:border-[var(--brand-mid)] focus:ring-2 focus:ring-violet-200 transition-shadow"
        />
      )}
    </div>
  );
}

/**
 * 팀원 목록 입력 (생성·수정 폼 공용)
 * 세션 + 이름 한 줄씩, "팀원 추가"로 행을 늘린다.
 * 이름을 비우면 그 세션은 모집중으로 표시된다.
 */
export function MembersInput({
  value,
  onChange,
}: {
  value: MemberEntry[];
  onChange: (rows: MemberEntry[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm font-semibold">
      <span>팀원</span>
      <div className="flex flex-col gap-2">
        {value.map((row, i) => (
          <MemberRow
            key={i}
            row={row}
            onUpdate={(patch) =>
              onChange(
                value.map((r, j) => (j === i ? { ...r, ...patch } : r))
              )
            }
            onRemove={() => onChange(value.filter((_, j) => j !== i))}
          />
        ))}
        <button
          type="button"
          onClick={() => onChange([...value, { session: "", name: "" }])}
          className="rounded-xl border border-dashed border-[var(--border)] p-2.5 text-sm font-normal text-zinc-500 hover:border-[var(--brand-mid)] hover:text-[var(--brand-text)] transition-colors"
        >
          + 팀원 추가
        </button>
      </div>
      <p className="text-xs font-normal text-zinc-500">
        이름을 비워두면 그 세션은 모집중으로 표시돼요.
      </p>
    </div>
  );
}
