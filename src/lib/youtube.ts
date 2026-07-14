/**
 * 유튜브 URL에서 영상 ID(11자)를 뽑는다 — 유튜브가 아니거나 ID를 찾지
 * 못하면 null. 지원 형태:
 *   youtube.com/watch?v=ID · youtu.be/ID · youtube.com/shorts/ID
 *   youtube.com/embed/ID · youtube.com/live/ID · music.youtube.com/watch?v=ID
 */
export function youtubeVideoId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m)\./, "");
  const ID = /^[A-Za-z0-9_-]{11}$/;

  if (host === "youtu.be") {
    const id = u.pathname.split("/")[1] ?? "";
    return ID.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "music.youtube.com") {
    const v = u.searchParams.get("v");
    if (v && ID.test(v)) return v;
    const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  return null;
}

/** 임베드 플레이어 주소 — nocookie 도메인으로 추적 쿠키 없이 재생 */
export const youtubeEmbedUrl = (videoId: string) =>
  `https://www.youtube-nocookie.com/embed/${videoId}`;
