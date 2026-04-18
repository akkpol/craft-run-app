import { readFileSync } from "node:fs";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";

let cachedPolicy = null;

function loadWorkflowPolicy() {
  if (!cachedPolicy) {
    const moduleDir = fileURLToPath(new URL(".", import.meta.url));
    const policyPath = path.join(
      moduleDir,
      "..",
      "..",
      "docs",
      "workflow-policy.json"
    );
    const raw = readFileSync(policyPath, "utf8");
    cachedPolicy = JSON.parse(raw);
  }

  return cachedPolicy;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function cloneArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function hasActiveJob(bundle) {
  return Boolean(bundle?.has_job || bundle?.job_status);
}

function isTerminalConversationState(state) {
  return loadWorkflowPolicy().conversation.terminalStates.includes(state);
}

function paymentUnlocksProduction(paymentTerms, paymentStatus) {
  if (!paymentTerms || !paymentStatus) {
    return false;
  }

  const unlockRules = loadWorkflowPolicy().quote_payment.unlockRules;
  return cloneArray(unlockRules[paymentTerms]).includes(paymentStatus);
}

function isWaitingPaymentBundle(bundle = {}) {
  if (bundle.conversation_state === "WAITING_PAYMENT") {
    return true;
  }

  return (
    bundle.quote_status === "approved" &&
    Boolean(bundle.payment_terms) &&
    Boolean(bundle.payment_status) &&
    !paymentUnlocksProduction(bundle.payment_terms, bundle.payment_status)
  );
}

function isClosedQuoteStatus(status) {
  return status === "rejected" || status === "expired";
}

function isOnCustomerHold(bundle = {}) {
  return (
    bundle.conversation_state === "ON_HOLD_CUSTOMER_INPUT" ||
    bundle.job_status === "ON_HOLD_CUSTOMER_INPUT"
  );
}

function getWorkflowSummary() {
  const policy = loadWorkflowPolicy();

  return {
    mode: policy.meta.mode,
    canonical_sources: cloneArray(policy.meta.canonicalSources),
    main_path: cloneArray(policy.meta.mainPath),
    branches: cloneArray(policy.meta.branches),
    payment_rules: {
      credit: "unlock_immediately",
      deposit: "unlock_on_partial_or_paid",
      prepaid: "unlock_on_paid",
    },
    notes: cloneArray(policy.meta.notes),
  };
}

function buildBlockedActions(actionCatalog, allowedActions, resolver) {
  const allowed = new Set(allowedActions);
  return cloneArray(actionCatalog)
    .filter((action) => !allowed.has(action))
    .map((action) => ({
      action,
      reason: resolver(action),
    }));
}

function getQuotePageActions(bundle = {}) {
  const policy = loadWorkflowPolicy();
  const quotePolicy = policy.policies.surfacePolicies.quote_page.customer;
  const allowedActions = cloneArray(quotePolicy.baseAllowedActions);
  let recommendedCtas = [];
  let uiIntent = "quote is available for customer review";

  if (isWaitingPaymentBundle(bundle)) {
    allowedActions.push(...quotePolicy.paymentGateCtas);
    recommendedCtas = cloneArray(quotePolicy.paymentGateCtas);
    uiIntent = policy.policies.reasons.paymentGate;
  } else if (
    cloneArray(quotePolicy.decisionWindowStatuses).includes(bundle.quote_status)
  ) {
    allowedActions.push(...quotePolicy.decisionCtas);
    recommendedCtas = cloneArray(quotePolicy.decisionCtas);
    uiIntent = "customer can approve, reject, or rescope the quote";
  } else if (isClosedQuoteStatus(bundle.quote_status)) {
    recommendedCtas = cloneArray(quotePolicy.closedCtas);
    allowedActions.push(...quotePolicy.closedCtas);
    uiIntent = policy.policies.reasons.quoteClosed;
  } else if (bundle.quote_status === "approved") {
    recommendedCtas = ["contact_admin"];
    uiIntent = policy.policies.reasons.quoteAlreadyApproved;
  }

  const blockedActions = buildBlockedActions(
    policy.surfaces.quote_page.ctaCatalog,
    allowedActions,
    (action) => {
      if (isWaitingPaymentBundle(bundle) && action === "approve_quote") {
        return policy.policies.reasons.paymentGate;
      }

      if (isClosedQuoteStatus(bundle.quote_status)) {
        return policy.policies.reasons.quoteClosed;
      }

      if (bundle.quote_status === "approved") {
        return policy.policies.reasons.quoteAlreadyApproved;
      }

      return "Action is outside the customer quote scope for this state.";
    }
  );

  return {
    allowed_actions: unique(allowedActions),
    blocked_actions: blockedActions,
    recommended_ctas: unique(recommendedCtas),
    ui_intent: uiIntent,
  };
}

function getStatusPageActions(bundle = {}) {
  const policy = loadWorkflowPolicy();
  const statusPolicy = policy.policies.surfacePolicies.status_page.customer;
  const allowedActions = cloneArray(statusPolicy.baseAllowedActions);
  let recommendedCtas = ["contact_admin"];
  let uiIntent = "customer can review status and wait for the next internal step";

  if (
    cloneArray(policy.design_job.customerResponseStatuses).includes(
      bundle.design_status
    )
  ) {
    allowedActions.push(...statusPolicy.previewResponseActions);
    recommendedCtas = cloneArray(statusPolicy.previewResponseActions);
    uiIntent = policy.policies.reasons.designWaiting;
  } else if (
    cloneArray(policy.design_job.teamOwnedStatuses).includes(bundle.design_status)
  ) {
    uiIntent = policy.policies.reasons.teamOwnedRevision;
  } else if (bundle.hold_reason && isOnCustomerHold(bundle)) {
    allowedActions.push(...statusPolicy.holdResolutionActions);
    recommendedCtas = [
      ...cloneArray(statusPolicy.holdResolutionActions),
      "contact_admin",
    ];
    uiIntent = policy.policies.reasons.holdResolution;
  }

  const blockedActions = buildBlockedActions(
    policy.surfaces.status_page.ctaCatalog,
    allowedActions,
    (action) => {
      if (
        cloneArray(policy.design_job.teamOwnedStatuses).includes(bundle.design_status)
      ) {
        return policy.policies.reasons.teamOwnedRevision;
      }

      if (
        cloneArray(policy.design_job.customerResponseStatuses).includes(
          bundle.design_status
        )
      ) {
        return action === "resolve_hold"
          ? "The active customer task is preview feedback, not hold resolution."
          : "Action is not part of the current preview feedback step.";
      }

      if (bundle.hold_reason && isOnCustomerHold(bundle)) {
        return action === "resolve_hold"
          ? "Action is already available."
          : "Only hold-resolution actions are available in this customer hold state.";
      }

      return "There is no active customer-facing response required for this action.";
    }
  );

  return {
    allowed_actions: unique(allowedActions),
    blocked_actions: blockedActions,
    recommended_ctas: unique(recommendedCtas),
    ui_intent: uiIntent,
  };
}

function getAdminDashboardActions() {
  const policy = loadWorkflowPolicy();
  const baseAllowedActions =
    policy.policies.surfacePolicies.admin_dashboard.admin.baseAllowedActions;

  return {
    allowed_actions: cloneArray(baseAllowedActions),
    blocked_actions: [],
    recommended_ctas: cloneArray(baseAllowedActions),
    ui_intent: "admin can drive quote, payment, design, and job operations",
  };
}

function getFlowPageActions() {
  const policy = loadWorkflowPolicy();
  const baseAllowedActions =
    policy.policies.surfacePolicies.flow_page.dev_ai.baseAllowedActions;

  return {
    allowed_actions: cloneArray(baseAllowedActions),
    blocked_actions: [],
    recommended_ctas: cloneArray(baseAllowedActions),
    ui_intent: "flow page is read-only documentation for customers and agents",
  };
}

function getAllowedActions(input = {}) {
  const { actor, surface, workflow_bundle: workflowBundle = {} } = input;

  if (actor === "customer" && surface === "quote_page") {
    return getQuotePageActions(workflowBundle);
  }

  if (actor === "customer" && surface === "status_page") {
    return getStatusPageActions(workflowBundle);
  }

  if (actor === "admin" && surface === "admin_dashboard") {
    return getAdminDashboardActions();
  }

  if (actor === "dev_ai" && surface === "flow_page") {
    return getFlowPageActions();
  }

  return {
    allowed_actions: [],
    blocked_actions: [],
    recommended_ctas: [],
    ui_intent: "No canonical policy is defined for this actor and surface pair.",
  };
}

function makeResult(decision, reason, nextState = null, sideEffects = [], missingRequirements = []) {
  return {
    decision,
    reason,
    next_state: nextState,
    side_effects: unique(sideEffects),
    missing_requirements: unique(missingRequirements),
  };
}

function validateConversationTransition(action, fromState = {}, context = {}) {
  const policy = loadWorkflowPolicy();
  const current = fromState.conversation_state;

  if (!current) {
    return makeResult(
      "requires_decision",
      "conversation_state is required to validate a conversation transition.",
      null,
      [],
      ["conversation_state"]
    );
  }

  if (isTerminalConversationState(current)) {
    return makeResult(
      "blocked",
      policy.policies.reasons.terminalConversation,
      null,
      [],
      ["Create a new conversation for fresh intake work."]
    );
  }

  let targetState = context.target_state ?? null;

  if (!targetState) {
    if (action === "approve_quote") {
      const paymentTerms = context.payment_terms ?? fromState.payment_terms;
      const paymentStatus = context.payment_status ?? fromState.payment_status;

      if (!paymentTerms || !paymentStatus) {
        return makeResult(
          "requires_decision",
          "payment_terms and payment_status are required to validate approve_quote at the conversation layer.",
          null,
          [],
          ["payment_terms", "payment_status"]
        );
      }

      targetState = paymentUnlocksProduction(paymentTerms, paymentStatus)
        ? policy.quote_payment.approvalDecisions.unlockedNextState
        : policy.quote_payment.approvalDecisions.lockedNextState;
    } else if (action === "resolve_hold") {
      targetState = hasActiveJob(fromState) ? "IN_DESIGN" : "REQUIREMENTS_REVIEW";
    }
  }

  if (!targetState) {
    return makeResult(
      "requires_decision",
      "The canonical policy does not define a deterministic conversation transition for this action without an explicit target_state.",
      null
    );
  }

  const allowedTargets = cloneArray(policy.conversation.transitions[current]);
  if (!allowedTargets.includes(targetState)) {
    return makeResult(
      "blocked",
      `${current} cannot move to ${targetState} in the current runtime workflow.`,
      null,
      [],
      [`Allowed targets: ${allowedTargets.join(", ") || "none"}`]
    );
  }

  return makeResult(
    "allowed",
    `Conversation can move from ${current} to ${targetState}.`,
    { conversation_state: targetState }
  );
}

function validateQuoteTransition(action, fromState = {}) {
  const status = fromState.quote_status;

  if (!status) {
    return makeResult(
      "requires_decision",
      "quote_status is required to validate quote actions.",
      null,
      [],
      ["quote_status"]
    );
  }

  if (action === "reject_quote") {
    if (status !== "sent") {
      return makeResult(
        "blocked",
        "Only a sent quote can be rejected.",
        null,
        [],
        ["quote_status must be sent"]
      );
    }

    if (hasActiveJob(fromState)) {
      return makeResult(
        "blocked",
        "A quote with an existing job should not be rejected from the public flow.",
        null,
        [],
        ["job must not exist"]
      );
    }

    return makeResult(
      "allowed",
      "Customer can reject a sent quote before a job exists.",
      {
        quote_status: "rejected",
        conversation_state: "CANCELLED",
      },
      ["cancel_lead", "clear_hold_reasons"]
    );
  }

  if (action === "rescope_quote") {
    if (!["sent", "approved"].includes(status)) {
      return makeResult(
        "blocked",
        "Only sent or approved quotes can be sent back for re-scope.",
        null,
        [],
        ["quote_status must be sent or approved"]
      );
    }

    if (hasActiveJob(fromState)) {
      return makeResult(
        "blocked",
        "Once a job exists, customer re-scope should not use the public quote flow.",
        null,
        [],
        ["job must not exist"]
      );
    }

    return makeResult(
      "allowed",
      "Customer can return the quote to requirements review before a job exists.",
      {
        quote_status: "rejected",
        conversation_state: "REQUIREMENTS_REVIEW",
        design_status: "not_started",
      },
      ["append_customer_note", "clear_human_review_reason"]
    );
  }

  if (action === "approve_quote") {
    return validatePaymentGateTransition(action, fromState);
  }

  return makeResult(
    "requires_decision",
    "The canonical policy does not define this quote transition explicitly."
  );
}

function validatePaymentGateTransition(action, fromState = {}, context = {}) {
  if (!["approve_quote", "update_payment_status"].includes(action)) {
    return makeResult(
      "requires_decision",
      "Unsupported payment gate action."
    );
  }

  const paymentTerms = context.payment_terms ?? fromState.payment_terms;
  let paymentStatus = context.payment_status ?? fromState.payment_status;

  if (!paymentTerms) {
    return makeResult(
      "requires_decision",
      "payment_terms is required to validate payment gate transitions.",
      null,
      [],
      ["payment_terms"]
    );
  }

  if (action === "approve_quote" && paymentTerms === "credit") {
    paymentStatus = "not_required";
  }

  if (!paymentStatus) {
    return makeResult(
      "requires_decision",
      "payment_status is required to validate payment gate transitions.",
      null,
      [],
      ["payment_status"]
    );
  }

  const unlocked = paymentUnlocksProduction(paymentTerms, paymentStatus);
  const nextConversationState = unlocked ? "IN_DESIGN" : "WAITING_PAYMENT";

  return makeResult(
    "allowed",
    unlocked
      ? "Payment terms unlock production, so the workflow can move into design."
      : "Payment does not unlock production yet, so the workflow remains gated on payment.",
    {
      conversation_state: nextConversationState,
      quote_status: "approved",
      payment_status: paymentStatus,
    },
    unlocked
      ? ["create_or_resume_job_if_absent", "notify_customer_status"]
      : ["mark_quote_approved", "wait_for_payment_confirmation"]
  );
}

function validateDesignFeedbackTransition(action, fromState = {}) {
  const policy = loadWorkflowPolicy();
  const designStatus = fromState.design_status;

  if (!designStatus) {
    return makeResult(
      "requires_decision",
      "design_status is required to validate design feedback transitions.",
      null,
      [],
      ["design_status"]
    );
  }

  if (action === "approve_design") {
    if (designStatus === "revision_requested") {
      return makeResult(
        "blocked",
        policy.policies.reasons.teamOwnedRevision,
        null,
        [],
        ["design_status must return to preview_sent before approve_design is valid"]
      );
    }

    if (designStatus !== "preview_sent") {
      return makeResult(
        "blocked",
        "Only preview_sent can be approved by the customer.",
        null,
        [],
        ["design_status must be preview_sent"]
      );
    }

    const hasJob = hasActiveJob(fromState);
    const nextConversationState =
      fromState.job_status === "ON_HOLD_CUSTOMER_INPUT"
        ? policy.design_job.constraints.designApprovalConversationState
        : policy.design_job.constraints.preJobDesignApprovalFallbackState;

    return makeResult(
      "allowed",
      hasJob
        ? "Customer can approve the active preview and resume the held job."
        : "Customer can approve the preview, but the workflow resumes the pre-job review path because no job exists yet.",
      {
        design_status: "approved",
        conversation_state: nextConversationState,
        job_status:
          fromState.job_status === "ON_HOLD_CUSTOMER_INPUT" ? "IN_DESIGN" : null,
      },
      hasJob
        ? ["mark_design_approved", "append_job_timeline", "resume_job"]
        : ["mark_design_approved", "resume_quote_or_payment_review"]
    );
  }

  if (action === "request_design_revision") {
    if (designStatus !== "preview_sent") {
      return makeResult(
        "blocked",
        designStatus === "revision_requested"
          ? policy.policies.reasons.teamOwnedRevision
          : "Customer revision requests are only valid after preview_sent.",
        null,
        [],
        ["design_status must be preview_sent"]
      );
    }

    return makeResult(
      "allowed",
      "Customer can request revisions on the current preview.",
      {
        design_status: "revision_requested",
        conversation_state:
          policy.design_job.constraints.designRevisionConversationState,
        job_status: hasActiveJob(fromState)
          ? "ON_HOLD_CUSTOMER_INPUT"
          : null,
      },
      ["persist_revision_note", "pause_job_if_present"]
    );
  }

  if (action === "resolve_hold") {
    if (!fromState.hold_reason) {
      return makeResult(
        "blocked",
        "resolve_hold requires an active hold_reason.",
        null,
        [],
        ["hold_reason"]
      );
    }

    return makeResult(
      "allowed",
      "Customer can clear the current hold by providing missing information.",
      {
        conversation_state: hasActiveJob(fromState) ? "IN_DESIGN" : "REQUIREMENTS_REVIEW",
        job_status: hasActiveJob(fromState) ? "IN_DESIGN" : null,
      },
      ["clear_hold_reason", "append_customer_note"]
    );
  }

  return makeResult(
    "requires_decision",
    "The canonical policy does not define this design feedback transition explicitly."
  );
}

function validateJobTransition(action, fromState = {}, context = {}) {
  const policy = loadWorkflowPolicy();
  const current = fromState.job_status;

  if (!current) {
    return makeResult(
      "requires_decision",
      "job_status is required to validate job transitions.",
      null,
      [],
      ["job_status"]
    );
  }

  if (["COMPLETED", "CANCELLED"].includes(current)) {
    return makeResult(
      "blocked",
      `Job is already terminal at ${current}.`
    );
  }

  const inferredTarget =
    context.target_status ??
    ({
      move_to_production: "IN_PRODUCTION",
      hold_for_customer: "ON_HOLD_CUSTOMER_INPUT",
      escalate_manual_review: "HUMAN_REVIEW_REQUIRED",
      resume_job: "IN_DESIGN",
      ready_for_fulfillment: "READY_FOR_FULFILLMENT",
      complete_job: "COMPLETED",
      cancel_job: "CANCELLED",
    }[action] ?? null);

  if (!inferredTarget) {
    return makeResult(
      "requires_decision",
      "Provide context.target_status for job validation when the action does not map to a canonical target."
    );
  }

  const allowedTargets = cloneArray(policy.design_job.jobTransitions[current]);
  if (!allowedTargets.includes(inferredTarget)) {
    return makeResult(
      "blocked",
      `${current} cannot move to ${inferredTarget} in the current job state machine.`,
      null,
      [],
      [`Allowed targets: ${allowedTargets.join(", ") || "none"}`]
    );
  }

  if (inferredTarget === "IN_PRODUCTION") {
    const paymentCleared =
      context.payment_cleared ??
      paymentUnlocksProduction(
        context.payment_terms ?? fromState.payment_terms,
        context.payment_status ?? fromState.payment_status
      );

    if (!paymentCleared) {
      return makeResult(
        "blocked",
        "Job cannot move to production until payment has unlocked production.",
        null,
        [],
        ["payment must be cleared"]
      );
    }

    if (
      fromState.design_status &&
      !cloneArray(policy.design_job.constraints.productionAllowedDesignStatuses).includes(
        fromState.design_status
      )
    ) {
      return makeResult(
        "blocked",
        "Job cannot move to production until design is approved or design is not required.",
        null,
        [],
        ["design_status must be approved or not_started"]
      );
    }
  }

  return makeResult(
    "allowed",
    `Job can move from ${current} to ${inferredTarget}.`,
    {
      job_status: inferredTarget,
      conversation_state: inferredTarget,
    }
  );
}

function validateTransition(input = {}) {
  const {
    entity,
    action,
    from_state: fromState = {},
    context = {},
  } = input;

  if (entity === "conversation") {
    return validateConversationTransition(action, fromState, context);
  }

  if (entity === "quote") {
    return validateQuoteTransition(action, fromState, context);
  }

  if (entity === "payment_gate") {
    return validatePaymentGateTransition(action, fromState, context);
  }

  if (entity === "design_feedback") {
    return validateDesignFeedbackTransition(action, fromState, context);
  }

  if (entity === "job") {
    return validateJobTransition(action, fromState, context);
  }

  return makeResult(
    "requires_decision",
    "Unknown entity for transition validation."
  );
}

function getUiContract(input = {}) {
  const policy = loadWorkflowPolicy();
  const { actor, surface, workflow_bundle: workflowBundle = {} } = input;
  const surfaceConfig = policy.surfaces[surface];
  const actionResult = getAllowedActions(input);

  if (!surfaceConfig) {
    return {
      show_sections: [],
      show_ctas: [],
      hide_ctas: [],
      copy_guidance: {},
      notes: ["No canonical UI contract is defined for this surface."],
    };
  }

  const showSections = cloneArray(surfaceConfig.baseSections);
  let copyGuidance = {};
  const notes = [];

  if (surface === "quote_page" && actor === "customer") {
    if (isWaitingPaymentBundle(workflowBundle)) {
      showSections.push(surfaceConfig.conditionalSections.waitingPayment);
      copyGuidance = {
        headline: "รอการชำระเงิน",
        tone: "instructional",
      };
      notes.push("Quote page should emphasize payment follow-up over quote approval.");
    } else if (workflowBundle.quote_status === "sent") {
      showSections.push(surfaceConfig.conditionalSections.decision);
      copyGuidance = {
        headline: "รอการตัดสินใจเรื่องใบเสนอราคา",
        tone: "decision",
      };
      notes.push("Customer can approve, reject, or re-scope the quote.");
    } else if (isClosedQuoteStatus(workflowBundle.quote_status)) {
      showSections.push(surfaceConfig.conditionalSections.closed);
      copyGuidance = {
        headline: "ใบเสนอราคานี้ปิดแล้ว",
        tone: "informational",
      };
      notes.push("Closed quotes should not render approval CTAs.");
    } else if (workflowBundle.quote_status === "approved") {
      copyGuidance = {
        headline: "ใบเสนอราคาได้รับการอนุมัติแล้ว",
        tone: "informational",
      };
      notes.push("Approved quotes should move the customer to the next operational step.");
    }
  }

  if (surface === "status_page" && actor === "customer") {
    if (workflowBundle.design_status === "preview_sent") {
      showSections.push(surfaceConfig.conditionalSections.preview);
      showSections.push(surfaceConfig.conditionalSections.responseBox);
      copyGuidance = {
        headline: "รอการตอบกลับเรื่องแบบ",
        tone: "instructional",
      };
      notes.push("Status page should present design approval and revision actions.");
    } else if (workflowBundle.design_status === "revision_requested") {
      showSections.push(surfaceConfig.conditionalSections.teamOwned);
      copyGuidance = {
        headline: "ทีมงานกำลังแก้แบบ",
        tone: "informational",
      };
      notes.push("After revision_requested, the next step belongs to the team.");
    } else if (workflowBundle.hold_reason && isOnCustomerHold(workflowBundle)) {
      showSections.push(surfaceConfig.conditionalSections.responseBox);
      copyGuidance = {
        headline: "รอข้อมูลเพิ่มเติมจากลูกค้า",
        tone: "instructional",
      };
      notes.push("Customer can clear the hold by submitting the missing information.");
    } else {
      copyGuidance = {
        headline: "ติดตามสถานะงาน",
        tone: "informational",
      };
      notes.push("Status page is read-only when there is no active customer response required.");
    }
  }

  if (surface === "admin_dashboard") {
    copyGuidance = {
      headline: "ทีมงานควบคุม workflow จากหน้านี้",
      tone: "operational",
    };
    notes.push("Admin dashboard exposes internal operational controls.");
  }

  if (surface === "flow_page") {
    copyGuidance = {
      headline: "เอกสารอธิบาย flow สำหรับคนและ agent",
      tone: "reference",
    };
    notes.push("Flow page should point back to the canonical workflow policy.");
  }

  return {
    show_sections: unique(showSections),
    show_ctas: cloneArray(actionResult.recommended_ctas),
    hide_ctas: cloneArray(surfaceConfig.ctaCatalog).filter(
      (action) => !actionResult.recommended_ctas.includes(action)
    ),
    copy_guidance: copyGuidance,
    notes,
  };
}

export {
  getAllowedActions,
  getUiContract,
  getWorkflowSummary,
  loadWorkflowPolicy as getWorkflowPolicy,
  paymentUnlocksProduction,
  validateTransition,
};
