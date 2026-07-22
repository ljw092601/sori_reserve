"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  DOW_LABELS,
  hhmmToMin,
  minToHHMM,
  type BlockRule,
} from "@/lib/block-rules";
import { BLOCK_RULE_NOTE_MAX } from "@/lib/constants";

/** 요일 선택지 — 월요일부터 보여준다 (day_of_week 값은 0=일 그대로) */
const DOW_OPTIONS = [1, 2, 3, 4, 5, 6, 0];

type Draft = { dayOfWeek: number; start: string; end: string; note: string };

const EMPTY_DRAFT: Draft = { dayOfWeek: 1, start: "", end: "", note: "" };

const inputCls =
  "rounded-xl border border-[var(--border)] bg-white p-2.5 text-sm font-normal outline-none focus:border-[var(--brand-mid)] focus:ring-2 focus:ring-violet-200 transition-shadow";

/**
 * 정기 사용 금지 규칙 관리 (임원 전용).
 * "매주 X요일 HH:mm~HH:mm" 규칙을 추가/수정/삭제한다.
 * 기한 없이 계속 적용되고, 수정·삭제하면 모든 주에 즉시 반영된다.
 */
export default function BlockRulesSection() {
  const router = useRouter();
  const [rules, setRules] = useState<BlockRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  /** 수정 중인 규칙 id — null이면 추가 폼으로 동작 */
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/block-rules")
      .then((res) => res.json())
      .then((data) => {
        if (data.rules) setRules(data.rules);
        else setError(data.error ?? "목록을 불러오지 못했습니다.");
      })
      .catch(() => setError("목록을 불러오지 못했습니다."));
  }, []);

  useEffect(load, [load]);

  /** 저장 성공 후 — 목록과 시간표(서버 렌더)를 함께 갱신 */
  function refresh() {
    load();
    router.refresh();
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const payload = {
      dayOfWeek: draft.dayOfWeek,
      startMin: hhmmToMin(draft.start),
      endMin: hhmmToMin(draft.end),
      note: draft.note,
    };
    try {
      const res = await fetch(
        editingId ? `/api/admin/block-rules/${editingId}` : "/api/admin/block-rules",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (res.ok) {
        setDraft(EMPTY_DRAFT);
        setEditingId(null);
        refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "저장에 실패했습니다.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
    setBusy(false);
  }

  function startEdit(rule: BlockRule) {
    setEditingId(rule.id);
    setDraft({
      dayOfWeek: rule.day_of_week,
      start: minToHHMM(rule.start_min),
      end: minToHHMM(rule.end_min),
      note: rule.note ?? "",
    });
    setError(null);
  }

  async function remove(rule: BlockRule) {
    if (
      !confirm(
        `매주 ${DOW_LABELS[rule.day_of_week]}요일 ${minToHHMM(rule.start_min)}~${minToHHMM(rule.end_min)} 금지를 삭제할까요?\n해당 시간대는 다시 예약할 수 있게 됩니다.`
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/block-rules/${rule.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (editingId === rule.id) {
          setEditingId(null);
          setDraft(EMPTY_DRAFT);
        }
        refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "삭제에 실패했습니다.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
    setBusy(false);
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-md">
      <div>
        <h2 className="text-base font-bold text-[var(--foreground)]">
          정기 사용 금지 (매주 반복)
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          요일과 시간대를 정하면 기한 없이 매주 그 시간에는 새 예약을 잡을 수
          없어요. 수정하거나 삭제하면 모든 주에 바로 반영돼요. (규칙을 만들기
          전에 이미 잡혀 있던 예약은 그대로 남으니 필요하면 직접 취소해주세요)
        </p>
      </div>

      {/* 등록된 규칙 목록 */}
      <ul className="flex flex-col divide-y divide-[var(--border)]">
        {(rules ?? []).map((rule) => (
          <li key={rule.id} className="flex items-center gap-3 py-2.5">
            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
              매주 {DOW_LABELS[rule.day_of_week]}
            </span>
            <span className="min-w-0 truncate text-sm font-medium text-[var(--foreground)]">
              {minToHHMM(rule.start_min)}~{minToHHMM(rule.end_min)}
              {rule.note && (
                <span className="ml-1.5 text-xs font-normal text-zinc-400">
                  {rule.note}
                </span>
              )}
            </span>
            <div className="ml-auto flex shrink-0 gap-1.5">
              <button
                onClick={() => startEdit(rule)}
                disabled={busy}
                className="rounded-lg border border-[var(--brand-mid)] px-2.5 py-1 text-xs font-medium text-[var(--brand-text)] hover:bg-[var(--brand-soft)] transition-colors disabled:opacity-40"
              >
                수정
              </button>
              <button
                onClick={() => remove(rule)}
                disabled={busy}
                className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-50 transition-colors disabled:opacity-40"
              >
                삭제
              </button>
            </div>
          </li>
        ))}
        {rules?.length === 0 && (
          <li className="py-2.5 text-sm text-zinc-400">
            아직 등록된 정기 금지가 없어요.
          </li>
        )}
        {rules === null && !error && (
          <li className="py-2.5 text-sm text-zinc-400">불러오는 중...</li>
        )}
      </ul>

      {/* 추가/수정 폼 — 수정 버튼을 누르면 이 폼에 값이 채워진다 */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-xl bg-[var(--surface-raised)] p-4"
      >
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {editingId ? "규칙 수정" : "규칙 추가"}
        </p>
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            요일
            <select
              value={draft.dayOfWeek}
              onChange={(e) =>
                setDraft({ ...draft, dayOfWeek: Number(e.target.value) })
              }
              className={inputCls}
            >
              {DOW_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {DOW_LABELS[d]}요일
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            시작
            <input
              type="time"
              required
              value={draft.start}
              onChange={(e) => setDraft({ ...draft, start: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            종료
            <input
              type="time"
              required
              value={draft.end}
              onChange={(e) => setDraft({ ...draft, end: e.target.value })}
              className={inputCls}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          메모 (선택)
          <input
            type="text"
            maxLength={BLOCK_RULE_NOTE_MAX}
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            placeholder="예: 정기 회의, 청소 시간"
            className={inputCls}
          />
        </label>

        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-xl p-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.99] disabled:opacity-50"
            style={{ background: "var(--brand-gradient)" }}
          >
            {busy ? "저장 중..." : editingId ? "수정 저장" : "규칙 추가"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setDraft(EMPTY_DRAFT);
                setError(null);
              }}
              className="rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-zinc-500 hover:bg-zinc-50 transition-colors"
            >
              취소
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
