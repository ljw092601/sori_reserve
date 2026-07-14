"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BOARD_DELETE_GRACE_HOURS, TIME_ZONE } from "@/lib/constants";

/** 게시판 관리 UI에 필요한 정보 — 서버 페이지에서 글 개수까지 채워서 내려준다 */
export type BoardWithCount = {
  id: string;
  name: string;
  /** 삭제 대기 시각 — null이면 정상 게시판 */
  deleted_at: string | null;
  postCount: number;
};

const inputClass =
  "min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-white p-2 text-sm font-normal outline-none focus:border-[var(--brand-mid)] focus:ring-2 focus:ring-violet-200 transition-shadow";
const buttonClass =
  "shrink-0 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:border-[var(--brand-mid)] hover:text-[var(--brand-text)] disabled:opacity-50";

/** 되돌리기 마감 시각 (삭제 시각 + 유예기간) 표시용 */
const restoreDeadline = (deletedAt: string) =>
  new Date(
    new Date(deletedAt).getTime() + BOARD_DELETE_GRACE_HOURS * 60 * 60 * 1000
  ).toLocaleString("ko-KR", {
    timeZone: TIME_ZONE,
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

/** 게시판 한 줄 — 이름 변경/삭제 (삭제는 24시간 안에 되돌릴 수 있다) */
function BoardRow({
  board,
  onError,
}: {
  board: BoardWithCount;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(board.name);
  const [busy, setBusy] = useState(false);

  async function rename() {
    onError(null);
    setBusy(true);
    const res = await fetch(`/api/boards/${board.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      onError(data?.error ?? "게시판 이름 변경에 실패했습니다.");
    }
    setBusy(false);
  }

  async function remove() {
    const postsWarning =
      board.postCount > 0
        ? `게시판의 모집글 ${board.postCount}개도 함께 삭제됩니다.\n`
        : "";
    if (
      !confirm(
        `"${board.name}" 게시판을 삭제할까요?\n` +
          postsWarning +
          `삭제 후 ${BOARD_DELETE_GRACE_HOURS}시간 안에는 게시판 관리에서 되돌릴 수 있어요.`
      )
    ) {
      return;
    }
    onError(null);
    setBusy(true);
    const res = await fetch(`/api/boards/${board.id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      onError(data?.error ?? "게시판 삭제에 실패했습니다.");
    }
    setBusy(false);
  }

  return (
    <li className="flex items-center gap-2">
      <input
        type="text"
        maxLength={50}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputClass}
      />
      <button
        type="button"
        disabled={busy || !name.trim() || name.trim() === board.name}
        onClick={rename}
        className={buttonClass}
      >
        이름 변경
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={remove}
        className={`${buttonClass} hover:border-red-300 hover:text-red-600`}
      >
        삭제
      </button>
    </li>
  );
}

/** 삭제 대기 게시판 한 줄 — 유예기간 안에는 되돌릴 수 있다 */
function DeletedBoardRow({
  board,
  onError,
}: {
  board: BoardWithCount;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function restore() {
    onError(null);
    setBusy(true);
    const res = await fetch(`/api/boards/${board.id}/restore`, {
      method: "POST",
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      onError(data?.error ?? "게시판 되돌리기에 실패했습니다.");
      // 유예기간 만료 등으로 목록이 달라졌을 수 있으니 새로 그린다
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <li className="flex items-center gap-2 rounded-xl bg-zinc-50 p-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-zinc-500 line-through">
          {board.name}
          {board.postCount > 0 && (
            <span className="ml-1 no-underline">
              (글 {board.postCount}개)
            </span>
          )}
        </p>
        {board.deleted_at && (
          <p className="text-xs text-zinc-400">
            {restoreDeadline(board.deleted_at)}까지 되돌리기 가능
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={restore}
        className={buttonClass}
      >
        되돌리기
      </button>
    </li>
  );
}

/** 임원 전용 게시판 관리 — 공연별 게시판 만들기/이름 변경/삭제/되돌리기 */
export default function BoardManager({
  boards,
  deletedBoards,
}: {
  boards: BoardWithCount[];
  deletedBoards: BoardWithCount[];
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const res = await fetch("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      setNewName("");
      // 새로 만든 게시판을 바로 보여준다
      router.push(
        data?.board?.id ? `/teams?board=${data.board.id}` : "/teams"
      );
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "게시판 만들기에 실패했습니다.");
    }
    setBusy(false);
  }

  return (
    <details className="mb-4 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-600">
        게시판 관리 (임원)
      </summary>

      <form onSubmit={handleCreate} className="mt-3 flex items-center gap-2">
        <input
          type="text"
          required
          maxLength={50}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="새 게시판 이름 (예: 2026 가을 정기공연)"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--brand-gradient)" }}
        >
          만들기
        </button>
      </form>

      {boards.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {boards.map((b) => (
            <BoardRow key={b.id} board={b} onError={setError} />
          ))}
        </ul>
      )}

      {deletedBoards.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-zinc-400">
            삭제 대기 중
          </h3>
          <ul className="flex flex-col gap-2">
            {deletedBoards.map((b) => (
              <DeletedBoardRow key={b.id} board={b} onError={setError} />
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <p className="mt-3 text-xs text-zinc-500">
        삭제한 게시판은 {BOARD_DELETE_GRACE_HOURS}시간 안에 되돌릴 수 있고,
        지나면 모집글·댓글·예약과 함께 완전히 삭제돼요.
      </p>
    </details>
  );
}
