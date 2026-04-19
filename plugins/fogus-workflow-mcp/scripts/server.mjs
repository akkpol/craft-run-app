import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import process from "node:process";
import { z } from "zod";

import {
  getAllowedActions,
  getUiContract,
  getWorkflowSummary,
  validateTransition,
} from "../../../src/lib/workflow-policy-core.mjs";

const workflowBundleSchema = z
  .object({
    conversation_state: z.string().optional(),
    quote_status: z.string().optional(),
    payment_terms: z.string().optional(),
    payment_status: z.string().optional(),
    design_status: z.string().optional(),
    job_status: z.string().optional(),
    has_job: z.boolean().optional(),
    hold_reason: z.string().nullable().optional(),
  })
  .strict();

const transitionContextSchema = z
  .record(z.string(), z.union([z.string(), z.boolean(), z.null()]))
  .optional();

function makeToolResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
    structuredContent: data,
  };
}

function makeErrorResult(message) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            error: message,
          },
          null,
          2
        ),
      },
    ],
    structuredContent: {
      error: message,
    },
  };
}

const server = new McpServer({
  name: "fogus-workflow-mcp",
  version: "1.0.0",
});

server.registerTool(
  "get_workflow_summary",
  {
    title: "Get Workflow Summary",
    description:
      "Return the canonical FOGUS current-runtime workflow summary and guard-rail notes.",
  },
  async () => makeToolResult(getWorkflowSummary())
);

server.registerTool(
  "get_allowed_actions",
  {
    title: "Get Allowed Actions",
    description:
      "Return allowed actions, blocked actions, and recommended CTAs for an actor on a workflow surface.",
    inputSchema: z.object({
      actor: z.string(),
      surface: z.string(),
      workflow_bundle: workflowBundleSchema.optional(),
    }),
  },
  async ({ actor, surface, workflow_bundle }) =>
    makeToolResult(
      getAllowedActions({
        actor,
        surface,
        workflow_bundle,
      })
    )
);

server.registerTool(
  "validate_transition",
  {
    title: "Validate Transition",
    description:
      "Validate a proposed workflow transition against the canonical current-runtime policy.",
    inputSchema: z.object({
      actor: z.string().optional(),
      entity: z.enum([
        "conversation",
        "quote",
        "payment_gate",
        "design_feedback",
        "job",
      ]),
      action: z.string(),
      from_state: workflowBundleSchema.optional(),
      context: transitionContextSchema,
    }),
  },
  async ({ actor, entity, action, from_state, context }) =>
    makeToolResult(
      validateTransition({
        actor,
        entity,
        action,
        from_state,
        context,
      })
    )
);

server.registerTool(
  "get_ui_contract",
  {
    title: "Get UI Contract",
    description:
      "Return the sections, CTAs, and copy guidance a surface should render for the supplied workflow bundle.",
    inputSchema: z.object({
      actor: z.string(),
      surface: z.string(),
      workflow_bundle: workflowBundleSchema.optional(),
    }),
  },
  async ({ actor, surface, workflow_bundle }) =>
    makeToolResult(
      getUiContract({
        actor,
        surface,
        workflow_bundle,
      })
    )
);

async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start MCP server";
    process.stdout.write(
      `${JSON.stringify(makeErrorResult(message))}\n`
    );
    process.exit(1);
  }
}

main();
