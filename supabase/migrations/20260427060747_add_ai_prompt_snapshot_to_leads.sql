alter table public.leads
add column if not exists ai_prompt_snapshot text;
