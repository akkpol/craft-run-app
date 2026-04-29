# 2026-04-27 Supabase Migration History Repair Plan

Role: follow-up-only plan

Status: Validated for forward-only path

## Goal

ทำให้ workflow ของ local repo, Supabase CLI, และ hosted project เดินต่อได้โดยไม่ replay schema change ที่มีอยู่แล้วบน production

## Verified Facts

- hosted schema มี object และ column ครบตาม migration local ชุดที่สงสัย
- remote migration history ไม่ตรงกับ local filenames และบางตัวใช้ version id คนละค่า
- ตอนนี้ไม่มี production schema change ค้างที่ต้อง apply เพิ่ม
- ความเสี่ยงหลักคือการ replay local-only migrations ซ้ำจนชน duplicate column, duplicate table, หรือ duplicate constraint

## Non-Goals

- ไม่แก้ production schema เพื่อไล่ให้ history ตรงกัน
- ไม่ insert หรือแก้ migration history record บน production โดยยังไม่ผ่าน dry-run และ validation
- ไม่ rewrite migration chain ใน branch หลักแบบฉับพลันโดยไม่มี baseline decision ชัดเจน

## Recommended Path

### Phase 1. Freeze And Record

1. ใช้ [docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md](../docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md) เป็นแหล่งอ้างอิงกลางของ incident นี้
2. หยุด apply local-only migration เก่าเข้ากับ hosted production จนกว่าจะจบ baseline decision
3. ก่อน migration งานถัดไป ให้ตรวจ schema จริงก่อนเสมอ ไม่ตัดสินจาก history list อย่างเดียว

### Phase 2. Choose A Canonical Baseline

เลือกหนึ่งทางก่อนลงมือ repair:

1. Remote-as-truth baseline, recommended
   ใช้ hosted schema และ remote migration history เป็น operational truth แล้วสร้างกระบวนการ local ใหม่ที่ต่อจากสถานะนี้
2. History reconciliation, high risk
   ทำให้ history table ตรงย้อนหลัง แต่ต้องพิสูจน์ผลกับ disposable environment ก่อนแตะ production

คำแนะนำตอนนี้คือใช้ทางเลือก 1 ก่อน เพราะแก้ blocker ได้โดยไม่เสี่ยงแตะ production history

### Phase 3. Validate Tooling Behavior Off Production

1. ใช้ disposable database หรือ project clone
2. ทดสอบว่าชุดไฟล์ migration ปัจจุบันทำให้ `supabase migration list`, `supabase db push`, และ workflow release ถัดไปทำงานได้หรือไม่
3. ถ้า tooling ยังทำงานได้โดยไม่ต้อง backfill history, ให้เก็บ drift นี้เป็น documented exception แล้วเดินหน้าด้วย forward-only migrations
4. ถ้า tooling ล้มเพราะ history mismatch, ค่อยย้ายไป phase 4

### Phase 4. Build A Clean Forward Path

ถ้า phase 3 บอกว่าจำเป็นต้องซ่อมจริง:

1. สร้าง dedicated branch สำหรับ migration-history repair เท่านั้น
2. snapshot current hosted schema เป็น baseline ที่ตรวจสอบได้
3. ออกแบบ clean path แบบใดแบบหนึ่ง:
   - baseline reset ที่ตั้งต้นจาก hosted schema ปัจจุบัน
   - single documented reconciliation step ที่ผ่านการทดสอบแล้ว
4. validate บน disposable environment จนแน่ใจว่า migration รอบถัดไป apply ได้โดยไม่ชน object เดิม
5. ค่อยนำแนวทางที่ผ่าน validation ไปใช้กับ production change management

## Decision Gate

ห้ามทำ production history repair จนกว่าจะตอบได้ครบ:

1. tooling ไหนเป็นตัว blocker จริง
2. baseline ใหม่จะถือ remote history หรือ current schema เป็น canonical truth
3. rehearsal บน disposable environment ผ่านแล้วหรือยัง
4. มี rollback story ที่ไม่ทำให้ production schema เสียหรือไม่

## Suggested Owner Outputs

- incident/runbook note: เสร็จแล้วใน [docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md](../docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md)
- next engineering task: ทดลอง CLI path บน disposable environment
- merge gate: อย่าเอา repair strategy เข้า branch หลักจนกว่าจะมี validation result ชัดเจน

## Validation Notes - 2026-04-27 Attempt 1

### Command Results

- `npx supabase --version` -> success (`2.92.1`)
- `npx supabase migration list --local` -> failed: local postgres not reachable at `127.0.0.1:54322`
- `npx supabase migration list` -> failed: `Cannot find project ref. Have you run supabase link?`
- `npx supabase db push --dry-run` -> failed: `Cannot find project ref. Have you run supabase link?`
- `npx supabase start` -> failed: Docker Desktop engine pipe not found

### Interpretation

- Current blocker in this environment is tooling prerequisites, not proven migration-history mismatch behavior.
- We still need one disposable environment run after Docker is available and one non-production linked project run to classify drift as `works-with-drift` or `blocked-by-history`.

### Required Next Action Before Decision Gate

1. Start Docker Desktop and rerun local disposable workflow.
2. Link a non-production Supabase project (`supabase link`) and rerun remote path checks.
3. Only after those two checks, decide between `Forward-only continues` and `Repair strategy required`.

## Validation Notes - 2026-04-29 MCP Session

### MCP Results

- `mcp_supabase_list_branches` -> success
   - default branch project ref: `wpayfrvvnwqiygnwrlfp`
   - preview branch candidate: `fix/quote-payment-instructions-mainbase` / `urfhisyagxmtsmeyvokg`
- `mcp_supabase_list_migrations` -> success
   - hosted history includes `20260423142830_repair_workflow_state_model_drift`
   - hosted history includes `20260426183238_repair_production_upload_schema_gate`
   - hosted history includes `20260427042022_repair_hosted_document_product_and_liff_gap`
   - hosted history includes `20260427043406_add_fulfillment_location_capture`
   - hosted history includes `20260427062532_add_ai_prompt_snapshot_to_leads`
- `mcp_supabase_execute_sql` safe verification queries -> success
   - `lead_media_assets.storage_provider` present
   - `lead_media_assets.storage_bucket` present
   - `leads.design_brief` present
   - `leads.ai_prompt_snapshot` present
   - `quotes.payment_profile_snapshot` present
   - `product_catalog_items` table present

### Interpretation

- The connected hosted project still looks like migration-history drift rather than missing production schema.
- We now have a known non-production preview branch identifier, but this session still lacks a branch-targeted dry-run or migration-list rehearsal on that disposable target.
- CLI auth remains unauthorized, so MCP became the current source of truth for hosted validation evidence.

### Required Next Action Before Decision Gate

1. Run the migration workflow against preview branch `urfhisyagxmtsmeyvokg` once either CLI auth is restored or the MCP connection is switched to that branch.
2. Record whether the disposable target behaves as `works-with-drift` or `blocked-by-history`.
3. Only then finalize `Forward-only continues` versus `Repair strategy required`.

## Validation Notes - 2026-04-29 Preview Branch CLI Session

### Command Results

- Loaded a valid Supabase PAT into the active shell and verified `npx supabase projects list` succeeded.
- `npx supabase link --project-ref urfhisyagxmtsmeyvokg --workdir .` -> success
- `npx supabase migration list` against linked preview branch -> success
   - remote history on the disposable target currently stops at `013`
   - newer local migrations appear as unapplied, but the command itself completed without history-order failure
- `npx supabase db push --dry-run` against linked preview branch -> success
   - CLI proposed the expected forward migration set (`014` through `20260427224500`)
   - no blocker signature, reconciliation error, or history-order refusal was returned

### Interpretation

- The disposable preview branch behaves as `works-with-drift`, not `blocked-by-history`.
- Current evidence supports the recommended `Remote-as-truth` production baseline plus forward-only migrations for future work.
- We still do not have a local SQL client path on this machine to run the runbook's schema presence queries directly against the preview branch, but the CLI rehearsal proved the migration workflow itself is not blocked by history drift.

### Decision Outcome

- `Forward-only continues`

### Required Next Action After Decision Gate

1. Keep production history immutable and continue treating hosted production schema plus history as operational truth.
2. When the next real schema change is needed, apply it as a new forward migration rather than attempting production history repair.
3. Use preview-branch or disposable-target rehearsals for future migration checks when the change is drift-sensitive.