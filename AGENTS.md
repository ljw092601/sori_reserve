<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# DB 스키마 변경 절차 (드리프트 방지)

`supabase/schema.sql`이 스키마의 단일 기준이다. 운영 DB에만 SQL을 실행하고 schema.sql을
안 고치는 실수가 반복됐다 (`profiles.role` 누락, RLS 활성화 누락 — 둘 다 리뷰에서 발견).

스키마를 변경할 때는 반드시 이 순서로:

1. **`supabase/schema.sql`을 먼저 수정** — 본 스키마 반영 + 파일 하단에 `[마이그레이션]` 주석 블록 추가
2. 그 마이그레이션 SQL을 운영 DB에 실행 (Supabase MCP `apply_migration` 또는 대시보드 SQL Editor)
3. 운영 DB에 직접 실행한 SQL을 발견하면(드리프트) 즉시 schema.sql에 소급 반영

운영 DB에만 실행하고 끝내는 것은 금지. 어느 쪽이 기준인지 애매해지면
`pg_tables`/`information_schema`로 운영 DB 실상을 조회해 schema.sql과 대조한다.
