"use client";

import { TEAM_STATUS_LABEL } from "@/lib/constants";
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
    <fieldset className="flex flex-col gap-1 text-sm font-medium">
      <legend className="mb-1">모집 상태</legend>
      <div className="flex gap-2">
        {(["recruiting", "closed"] as const).map((s) => (
          <label
            key={s}
            className={`flex-1 cursor-pointer rounded-lg border p-2.5 text-center text-sm font-medium ${
              value === s
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500"
            }`}
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
  function update(i: number, patch: Partial<MemberEntry>) {
    onChange(value.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }
  function remove(i: number) {
    onChange(value.filter((_, j) => j !== i));
  }
  function add() {
    onChange([...value, { session: "", name: "" }]);
  }

  return (
    <div className="flex flex-col gap-1 text-sm font-medium">
      <span>팀원</span>
      <div className="flex flex-col gap-2">
        {value.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={row.session}
              onChange={(e) => update(i, { session: e.target.value })}
              maxLength={20}
              placeholder="세션 (예: 드럼)"
              className="w-0 flex-1 rounded-lg border border-zinc-300 bg-white p-2.5"
            />
            <input
              type="text"
              value={row.name}
              onChange={(e) => update(i, { name: e.target.value })}
              maxLength={20}
              placeholder="이름 (비우면 모집중)"
              className="w-0 flex-1 rounded-lg border border-zinc-300 bg-white p-2.5"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="팀원 줄 삭제"
              className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2.5 text-zinc-400 hover:border-red-300 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-dashed border-zinc-300 p-2.5 text-sm text-zinc-500 hover:border-zinc-500 hover:text-zinc-700"
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
