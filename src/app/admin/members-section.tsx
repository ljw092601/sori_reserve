"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminMember } from "@/app/api/admin/members/route";

const ROLE_LABEL = { exec: "임원", member: "부원" } as const;

/**
 * 임원 관리 섹션 (임원 전용).
 * 한 번이라도 로그인한 사용자를 나열하고 승급/강등한다.
 * 본인 역할은 바꿀 수 없다 — 임원이 0명이 되는 사고 방지.
 */
export default function MembersSection() {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/members")
      .then((res) => res.json())
      .then((data) => {
        if (data.members) setMembers(data.members);
        else setError(data.error ?? "목록을 불러오지 못했습니다.");
      })
      .catch(() => setError("목록을 불러오지 못했습니다."));
  }, []);

  useEffect(load, [load]);

  async function changeRole(member: AdminMember) {
    const next = member.role === "exec" ? "member" : "exec";
    setError(null);
    setBusyId(member.id);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.id, role: next }),
      });
      if (res.ok) {
        load();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "역할 변경에 실패했습니다.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
    setBusyId(null);
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-md">
      <div>
        <h2 className="text-base font-bold text-[var(--foreground)]">
          임원 관리
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          부원을 임원으로 승급시키거나 임원을 부원으로 되돌려요. 다음 임원진에게
          넘길 때는 새 임원을 먼저 승급시키고, 새 임원이 이전 임원을
          강등해주세요. (본인 역할은 바꿀 수 없어요)
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}

      <ul className="flex flex-col divide-y divide-[var(--border)]">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2.5">
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                m.role === "exec"
                  ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
                  : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {ROLE_LABEL[m.role]}
            </span>
            <span className="min-w-0 truncate text-sm font-medium text-[var(--foreground)]">
              {m.name}
              {m.self && (
                <span className="ml-1.5 text-xs font-normal text-zinc-400">
                  (나)
                </span>
              )}
            </span>
            {!m.self && (
              <button
                onClick={() => changeRole(m)}
                disabled={busyId !== null}
                className={`ml-auto shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                  m.role === "exec"
                    ? "border-[var(--border)] text-zinc-500 hover:bg-zinc-50"
                    : "border-[var(--brand-mid)] text-[var(--brand-text)] hover:bg-[var(--brand-soft)]"
                }`}
              >
                {busyId === m.id
                  ? "변경 중..."
                  : m.role === "exec"
                    ? "부원으로 강등"
                    : "임원으로 승급"}
              </button>
            )}
          </li>
        ))}
        {members.length === 0 && !error && (
          <li className="py-2.5 text-sm text-zinc-400">불러오는 중...</li>
        )}
      </ul>
    </section>
  );
}
