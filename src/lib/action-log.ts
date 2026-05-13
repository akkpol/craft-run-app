/**
 * action-log.ts
 *
 * Central helper for logging every state-changing action in FOGUS.
 * Every call must record: what happened, on which entity, and who did it
 * (human / ai / system).
 *
 * The generated `action_ref` (ACT-YYYYMMDD-NNNN) is returned so callers
 * can include it in API responses, LINE messages, or job timeline notes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ────────────────────────────────────────────────────────────────────

export type ActorType = "human" | "ai" | "system";

export type EntityType =
  | "conversation"
  | "lead"
  | "quote"
  | "job"
  | "message"
  | "production_event"
  | "system";

/** Canonical action_type strings — extend as needed, keep dot-namespaced. */
export type ActionType =
  // Conversation
  | "conversation.created"
  | "conversation.state_changed"
  | "conversation.escalated"
  // LINE ops
  | "line.webhook_received"
  | "line.reply_sent"
  | "line.reply_failed"
  | "line.push_sent"
  | "line.push_failed"
  // Message
  | "message.unsent"
  // Lead / Intake
  | "lead.created"
  | "lead.design_status_changed"
  | "lead.hold_customer_input"
  | "lead.superseded"
  // Quote
  | "quote.created"
  | "quote.sent"
  | "quote.approved"
  | "quote.rejected"
  | "quote.commercial_updated"
  // Commercial
  | "commercial.document_delivery_skipped_no_token"
  | "commercial.document_delivery_skipped_no_conv"
  | "commercial.document_delivery_skipped_conv_missing"
  | "commercial.document_delivery_skipped_no_user_id"
  | "commercial.document_sent"
  // Job
  | "job.created"
  | "job.status_changed"
  | "job.cancelled"
  // AI
  | "ai.preview_generated"
  | "ai.preview_failed"
  // Production
  | "production.event_sent"
  | "production.event_approved"
  | "production.event_rejected"
  | "production.media_uploaded"
  | "production.completion_package_sent"
  // Settings
  | "settings.updated"
  // Generic fallback
  | (string & Record<never, never>); // allows literal strings not in the union

export interface LogActionInput {
  /** Table / domain the action targets */
  entityType: EntityType;
  /** UUID of the affected row (optional for system-level actions) */
  entityId?: string;
  /** Dot-namespaced action type, e.g. "job.status_changed" */
  actionType: ActionType;
  /** Who performed the action */
  actorType: ActorType;
  /** LINE user ID, admin email, or service name ("webhook", "intake", "scheduler") */
  actorId?: string;
  /** Human-readable label shown in audit UIs */
  actorLabel?: string;
  /** Free-text note (same as job_timeline.note) */
  note?: string;
  /** Structured context — avoid PII; prefer state names, IDs, enums */
  payload?: Record<string, unknown>;
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Write one row to `action_log`.
 *
 * Returns the generated `action_ref` (e.g. "ACT-20260419-0042") on success,
 * or `null` on failure (error is logged to console — never throws).
 *
 * @example
 * const ref = await logAction(supabase, {
 *   entityType: "job",
 *   entityId: job.id,
 *   actionType: "job.status_changed",
 *   actorType: "human",
 *   actorId: adminEmail,
 *   actorLabel: "Admin",
 *   payload: { from: prevStatus, to: nextStatus },
 * });
 */
export async function logAction(
  supabase: SupabaseClient,
  input: LogActionInput
): Promise<string | null> {
  const { data, error } = await supabase
    .from("action_log")
    .insert({
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      action_type: input.actionType,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      actor_label: input.actorLabel ?? null,
      note: input.note ?? null,
      payload: input.payload ?? null,
    })
    .select("action_ref")
    .single();

  if (error) {
    // Non-fatal: audit failure must never break the main flow
    console.error(
      `[action-log] failed to log "${input.actionType}" on ${input.entityType}/${input.entityId ?? "system"}:`,
      error.message
    );
    return null;
  }

  return data?.action_ref ?? null;
}

// ── Convenience builders ──────────────────────────────────────────────────────

/** Log a system-originated action (webhook, scheduler, auto-process). */
export function logSystemAction(
  supabase: SupabaseClient,
  input: Omit<LogActionInput, "actorType"> & { serviceName: string }
): Promise<string | null> {
  const { serviceName, ...rest } = input;
  return logAction(supabase, {
    ...rest,
    actorType: "system",
    actorId: serviceName,
    actorLabel: serviceName,
  });
}

/** Log an AI-originated action (image generation, auto-reply, etc.). */
export function logAiAction(
  supabase: SupabaseClient,
  input: Omit<LogActionInput, "actorType">
): Promise<string | null> {
  return logAction(supabase, { ...input, actorType: "ai", actorId: input.actorId ?? "fogus-ai" });
}

/** Log a human action (admin, customer). */
export function logHumanAction(
  supabase: SupabaseClient,
  input: Omit<LogActionInput, "actorType">
): Promise<string | null> {
  return logAction(supabase, { ...input, actorType: "human" });
}
