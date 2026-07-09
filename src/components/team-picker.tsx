"use client";

import { useState } from "react";
import type { Team } from "@/lib/types";

/**
 * 검색형 팀 선택 콤보박스.
 * 곡 제목으로 타이핑 검색 → 목록에서 클릭해 선택한다.
 * 같은 곡 제목의 팀이 있을 수 있어 작성자 이름을 함께 표시한다.
 */
export default function TeamPicker({
  teams,
  value,
  onChange,
}: {
  teams: Team[];
  value: string;
  onChange: (teamId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = teams.find((t) => t.id === value) ?? null;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? teams.filter((t) => t.name.toLowerCase().includes(q))
    : teams;

  function pick(team: Team) {
    onChange(team.id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={open ? query : (selected?.name ?? "")}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange(""); // 다시 입력하면 선택 해제
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        placeholder={
          teams.length > 0 ? "곡 제목으로 검색" : "선택할 수 있는 팀이 없어요"
        }
        className="w-full rounded-lg border border-zinc-300 bg-white p-2.5"
      />
      {selected && !open && (
        <span
          className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full"
          style={{ backgroundColor: selected.color }}
        />
      )}

      {open && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {filtered.length > 0 ? (
            filtered.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  // onClick은 blur 뒤에 실행돼 목록이 먼저 닫히므로 onMouseDown 사용
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(t);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="truncate">{t.name}</span>
                  {t.created_by_name && (
                    <span className="ml-auto shrink-0 text-xs text-zinc-400">
                      {t.created_by_name}
                    </span>
                  )}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-zinc-400">
              검색 결과가 없어요
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
