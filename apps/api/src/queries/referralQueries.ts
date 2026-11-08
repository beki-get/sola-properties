import { pool } from "../config/database";

export class ReferralError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ReferralError";
  }
}

interface CreateReferralInput {
  buyerId: string;
  propertyId: string;
  message?: string | null;
}

export async function createReferralWithHistory(input: CreateReferralInput) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const buyer = await client.query(
      `SELECT id
       FROM users
       WHERE id = $1
         AND role = 'buyer'
         AND status = 'approved'
         AND email_verified_at IS NOT NULL`,
      [input.buyerId],
    );

    if (!buyer.rows[0]) {
      throw new ReferralError(
        403,
        "BUYER_NOT_ELIGIBLE",
        "An approved, email-verified buyer account is required.",
      );
    }

    const propertyResult = await client.query<{
      id: string;
      owner_id: string;
      owner_role: string;
      owner_status: string;
      owner_email_verified_at: Date | null;
      status: string;
    }>(
      `SELECT
         p.id,
         p.owner_id,
         owner.role AS owner_role,
         owner.status AS owner_status,
         owner.email_verified_at AS owner_email_verified_at,
         p.status
       FROM properties p
       JOIN users owner ON owner.id = p.owner_id
       WHERE p.id = $1
       FOR UPDATE OF p`,
      [input.propertyId],
    );

    const property = propertyResult.rows[0];

    if (!property) {
      throw new ReferralError(404, "PROPERTY_NOT_FOUND", "Property not found.");
    }

    if (property.status !== "active") {
      throw new ReferralError(
        409,
        "PROPERTY_NOT_ACTIVE",
        "Inquiries can only be created for active properties.",
      );
    }

    if (!["agent", "developer"].includes(property.owner_role)) {
      throw new ReferralError(
        409,
        "PROPERTY_OWNER_NOT_ELIGIBLE",
        "The property owner cannot receive referrals.",
      );
    }

    if (
      property.owner_status !== "approved" ||
      !property.owner_email_verified_at
    ) {
      throw new ReferralError(
        409,
        "PROPERTY_OWNER_NOT_ELIGIBLE",
        "The property owner is not currently eligible to receive referrals.",
      );
    }

    let assignedTo = property.owner_id;

    // Agent-owned property: assign directly to its owner.
    // Developer-owned property: prefer an eligible authorized agent.
    if (property.owner_role === "developer") {
      const authorizationResult = await client.query<{ agent_id: string }>(
        `SELECT pa.agent_id
         FROM property_authorizations pa
         JOIN users agent ON agent.id = pa.agent_id
         WHERE pa.property_id = $1
           AND pa.status = 'active'
           AND agent.role = 'agent'
           AND agent.status = 'approved'
           AND agent.email_verified_at IS NOT NULL
         ORDER BY pa.created_at ASC, pa.agent_id ASC
         LIMIT 1
         FOR UPDATE OF pa`,
        [input.propertyId],
      );

      if (authorizationResult.rows[0]) {
        assignedTo = authorizationResult.rows[0].agent_id;
      }
    }

    const referralResult = await client.query(
      `INSERT INTO referrals
         (buyer_id, property_id, assigned_to, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, reference_code, buyer_id, property_id,
                 assigned_to, message, status, status_reason,
                 assigned_at, accepted_at, created_at, updated_at`,
      [
        input.buyerId,
        input.propertyId,
        assignedTo,
        input.message?.trim() || null,
      ],
    );

    const referral = referralResult.rows[0];

    await client.query(
      `INSERT INTO referral_events
         (referral_id, actor_id, event_type, status, assigned_to)
       VALUES
         ($1, $2, 'created', 'assigned', $3),
         ($1, NULL, 'assigned', 'assigned', $3)`,
      [referral.id, input.buyerId, assignedTo],
    );

    await client.query("COMMIT");

    return referral;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }

    if (error instanceof ReferralError) {
      throw error;
    }

    const dbError = error as {
      code?: string;
      constraint?: string;
    };

    if (
      dbError.code === "23505" &&
      dbError.constraint === "referrals_one_open_per_buyer_property"
    ) {
      throw new ReferralError(
        409,
        "DUPLICATE_ACTIVE_REFERRAL",
        "You already have an open referral for this property.",
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

//developer or agent

export async function getAssignedReferrals(agentId: string) {
  const result = await pool.query(
    `SELECT
       r.id,
       r.reference_code,
       r.buyer_id,
       buyer.full_name AS buyer_name,
       r.property_id,
       p.title AS property_title,
       r.message,
       r.status,
       r.status_reason,
       r.assigned_at,
       r.accepted_at,
       r.created_at,
       r.updated_at
     FROM referrals r
     JOIN users buyer ON buyer.id = r.buyer_id
     JOIN properties p ON p.id = r.property_id
     WHERE r.assigned_to = $1
     ORDER BY r.assigned_at DESC, r.created_at DESC`,
    [agentId],
  );

  return result.rows;
}

type ReferralDecision = "accepted" | "rejected";

//accept or reject referral
export async function decideReferral(input: {
  referralId: string;
  actorId: string;
  decision: ReferralDecision;
  reason?: string;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT id, assigned_to, status
       FROM referrals
       WHERE id = $1
       FOR UPDATE`,
      [input.referralId],
    );

    const referral = result.rows[0];

    if (!referral) {
      throw new ReferralError(404, "REFERRAL_NOT_FOUND", "Referral not found.");
    }

    if (referral.assigned_to !== input.actorId) {
      throw new ReferralError(
        403,
        "REFERRAL_NOT_ASSIGNED",
        "This referral is not assigned to you.",
      );
    }

    if (referral.status !== "assigned") {
      throw new ReferralError(
        409,
        "INVALID_REFERRAL_TRANSITION",
        "Only assigned referrals can be accepted or rejected.",
      );
    }

    if (input.decision === "rejected" && !input.reason?.trim()) {
      throw new ReferralError(
        400,
        "REJECTION_REASON_REQUIRED",
        "A reason is required when rejecting a referral.",
      );
    }

    const updated = await client.query(
      `UPDATE referrals
       SET status = $2,
           status_reason = $3,
           accepted_at = CASE WHEN $4 THEN NOW() ELSE accepted_at END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, reference_code, buyer_id, property_id, assigned_to,
                 message, status, status_reason, assigned_at, accepted_at,
                 created_at, updated_at`,
      [
        input.referralId,
        input.decision,
        input.decision === "rejected" ? input.reason!.trim() : null,
        input.decision === "accepted",
      ],
    );

    await client.query(
      `INSERT INTO referral_events
         (referral_id, actor_id, event_type, status, assigned_to, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.referralId,
        input.actorId,
        input.decision,
        input.decision,
        input.actorId,
        input.decision === "rejected" ? input.reason!.trim() : null,
      ],
    );

    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}

const allowedReferralTransitions: Record<string, string[]> = {
  accepted: ["in_progress", "closed_lost"],
  in_progress: ["agreement", "closed_lost"],
  agreement: ["closed_won", "closed_lost"],
};

export async function changeReferralStatus(input: {
  referralId: string;
  actorId: string;
  status: "in_progress" | "agreement" | "closed_won" | "closed_lost";
  reason?: string;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT id, assigned_to, status
       FROM referrals
       WHERE id = $1
       FOR UPDATE`,
      [input.referralId],
    );

    const referral = result.rows[0];

    if (!referral) {
      throw new ReferralError(404, "REFERRAL_NOT_FOUND", "Referral not found.");
    }

    if (referral.assigned_to !== input.actorId) {
      throw new ReferralError(
        403,
        "REFERRAL_NOT_ASSIGNED",
        "This referral is not assigned to you.",
      );
    }

    if (!allowedReferralTransitions[referral.status]?.includes(input.status)) {
      throw new ReferralError(
        409,
        "INVALID_REFERRAL_TRANSITION",
        `Cannot change referral status from '${referral.status}' to '${input.status}'.`,
      );
    }

    if (input.status === "closed_lost" && !input.reason?.trim()) {
      throw new ReferralError(
        400,
        "STATUS_REASON_REQUIRED",
        "A reason is required when marking a referral as lost.",
      );
    }

    const updated = await client.query(
      `UPDATE referrals
       SET status = $2,
           status_reason = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, reference_code, buyer_id, property_id, assigned_to,
                 message, status, status_reason, assigned_at, accepted_at,
                 created_at, updated_at`,
      [
        input.referralId,
        input.status,
        input.status === "closed_lost" ? input.reason!.trim() : null,
      ],
    );

    await client.query(
      `INSERT INTO referral_events
         (referral_id, actor_id, event_type, status, assigned_to, note)
       VALUES ($1, $2, 'status_changed', $3, $2, $4)`,
      [
        input.referralId,
        input.actorId,
        input.status,
        input.reason?.trim() || null,
      ],
    );

    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}

//admin reassignment of referral to another agent or developer
export interface ReassignReferralInput {
  referralId: string;
  actorId: string;
  newAssigneeId: string;
  reason?: string;
}

export async function reassignReferral(input: ReassignReferralInput) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT
         r.id,
         r.assigned_to,
         r.status,
         p.owner_id,
         owner.role AS owner_role,
         p.status AS property_status
       FROM referrals r
       JOIN properties p ON p.id = r.property_id
       JOIN users owner ON owner.id = p.owner_id
       WHERE r.id = $1
       FOR UPDATE OF r, p`,
      [input.referralId],
    );

    const referral = result.rows[0];

    if (!referral) {
      throw new ReferralError(404, "REFERRAL_NOT_FOUND", "Referral not found.");
    }

    if (!["assigned", "rejected"].includes(referral.status)) {
      throw new ReferralError(
        409,
        "REFERRAL_NOT_REASSIGNABLE",
        "Only assigned or rejected referrals can be reassigned.",
      );
    }

    if (referral.property_status !== "active") {
      throw new ReferralError(
        409,
        "PROPERTY_NOT_ACTIVE",
        "Referrals can only be reassigned for active properties.",
      );
    }

    if (referral.assigned_to === input.newAssigneeId) {
      throw new ReferralError(
        400,
        "SAME_ASSIGNEE",
        "The referral is already assigned to this user.",
      );
    }

    const assigneeResult = await client.query(
      `SELECT id, role
       FROM users
       WHERE id = $1
         AND status = 'approved'
         AND email_verified_at IS NOT NULL
         AND role IN ('agent', 'developer')`,
      [input.newAssigneeId],
    );

    const newAssignee = assigneeResult.rows[0];

    if (!newAssignee) {
      throw new ReferralError(
        400,
        "INVALID_ASSIGNEE",
        "The new assignee must be an approved, email-verified agent or developer.",
      );
    }

    let isEligible = false;

    if (referral.owner_role === "agent") {
      isEligible = input.newAssigneeId === referral.owner_id;
    } else if (referral.owner_role === "developer") {
      if (newAssignee.role === "developer") {
        isEligible = input.newAssigneeId === referral.owner_id;
      } else if (newAssignee.role === "agent") {
        const authorization = await client.query(
          `SELECT 1
           FROM property_authorizations
           WHERE property_id = (
             SELECT property_id FROM referrals WHERE id = $1
           )
             AND agent_id = $2
             AND status = 'active'`,
          [input.referralId, input.newAssigneeId],
        );

        isEligible = (authorization.rowCount ?? 0) > 0;
      }
    }

    if (!isEligible) {
      throw new ReferralError(
        403,
        "ASSIGNEE_NOT_AUTHORIZED",
        "The selected user is not authorized to receive referrals for this property.",
      );
    }

    const oldAssigneeId = referral.assigned_to;

    const updated = await client.query(
      `UPDATE referrals
       SET assigned_to = $2,
           status = 'assigned',
           status_reason = NULL,
           accepted_at = NULL,
           assigned_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, reference_code, buyer_id, property_id, assigned_to,
                 message, status, status_reason, assigned_at, accepted_at,
                 created_at, updated_at`,
      [input.referralId, input.newAssigneeId],
    );

    await client.query(
      `INSERT INTO referral_events
         (referral_id, actor_id, event_type, status,
          assigned_to, previous_assigned_to, note)
       VALUES ($1, $2, 'reassigned', 'assigned', $3, $4, $5)`,
      [
        input.referralId,
        input.actorId,
        input.newAssigneeId,
        oldAssigneeId,
        input.reason?.trim() || null,
      ],
    );

    await client.query(
      `INSERT INTO audit_logs
         (actor_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, 'referral_reassigned', 'referral', $2, $3, $4)`,
      [
        input.actorId,
        input.referralId,
        { assignedTo: oldAssigneeId, status: referral.status },
        {
          assignedTo: input.newAssigneeId,
          status: "assigned",
          reason: input.reason?.trim() || null,
        },
      ],
    );

    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}

//admin view of all referrals with optional status filter
export async function getAllReferrals(status?: string) {
  const result = await pool.query(
    `SELECT
       r.id,
       r.reference_code,
       r.buyer_id,
       buyer.full_name AS buyer_name,
       r.property_id,
       p.title AS property_title,
       r.assigned_to,
       assignee.full_name AS assignee_name,
       r.message,
       r.status,
       r.status_reason,
       r.assigned_at,
       r.accepted_at,
       r.created_at,
       r.updated_at
     FROM referrals r
     JOIN users buyer ON buyer.id = r.buyer_id
     JOIN properties p ON p.id = r.property_id
     JOIN users assignee ON assignee.id = r.assigned_to
     WHERE ($1::referral_status IS NULL OR r.status = $1)
     ORDER BY r.created_at DESC`,
    [status || null],
  );

  return result.rows;
}

//admin view of a specific referral with details
export async function getReferralDetails(referralId: string) {
  const result = await pool.query(
    `SELECT
       r.id,
       r.reference_code,
       r.buyer_id,
       buyer.full_name AS buyer_name,
       buyer.email AS buyer_email,
       r.property_id,
       p.title AS property_title,
       r.assigned_to,
       assignee.full_name AS assignee_name,
       assignee.email AS assignee_email,
       r.message,
       r.status,
       r.status_reason,
       r.assigned_at,
       r.accepted_at,
       r.created_at,
       r.updated_at
     FROM referrals r
     JOIN users buyer ON buyer.id = r.buyer_id
     JOIN properties p ON p.id = r.property_id
     JOIN users assignee ON assignee.id = r.assigned_to
     WHERE r.id = $1`,
    [referralId],
  );

  if (!result.rows[0]) {
    throw new ReferralError(404, "REFERRAL_NOT_FOUND", "Referral not found.");
  }

  return result.rows[0];
}

//admin view of referral history with events and actors
export async function getReferralHistory(referralId: string) {
  const result = await pool.query(
    `SELECT
       r.id AS referral_id,
       e.id AS event_id,
       e.actor_id,
       actor.full_name AS actor_name,
       e.event_type,
       e.status,
       e.assigned_to,
       assignee.full_name AS assignee_name,
       e.previous_assigned_to,
       previous_assignee.full_name AS previous_assignee_name,
       e.note,
       e.created_at
     FROM referrals r
     LEFT JOIN referral_events e ON e.referral_id = r.id
     LEFT JOIN users actor ON actor.id = e.actor_id
     LEFT JOIN users assignee ON assignee.id = e.assigned_to
     LEFT JOIN users previous_assignee
       ON previous_assignee.id = e.previous_assigned_to
     WHERE r.id = $1
     ORDER BY e.created_at ASC, e.id ASC`,
    [referralId],
  );

  if (!result.rows.length) {
    throw new ReferralError(404, "REFERRAL_NOT_FOUND", "Referral not found.");
  }

  return result.rows.filter((row) => row.event_id !== null);
}

//buyer view of their referrals with property and assignee details
export async function getBuyerReferrals(buyerId: string) {
  const result = await pool.query(
    `SELECT
       r.id,
       r.reference_code,
       r.property_id,
       p.title AS property_title,
       r.assigned_to,
       assignee.full_name AS assignee_name,
       assignee.role AS assignee_role,
       r.message,
       r.status,
       r.status_reason,
       r.assigned_at,
       r.accepted_at,
       r.created_at,
       r.updated_at
     FROM referrals r
     JOIN properties p ON p.id = r.property_id
     JOIN users assignee ON assignee.id = r.assigned_to
     WHERE r.buyer_id = $1
     ORDER BY r.created_at DESC`,
    [buyerId],
  );

  return result.rows;
}

//folow-up messages for a referral, visible to the assigned agent/developer
export async function createReferralFollowUp(input: {
  referralId: string;
  senderId: string;
  body: string;
  dueAt?: string;
}) {
  const result = await pool.query(
    `INSERT INTO referral_messages (
       referral_id,
       sender_id,
       kind,
       body,
       due_at
     )
     SELECT r.id, $2, 'follow_up', $3, $4
     FROM referrals r
     WHERE r.id = $1
       AND r.assigned_to = $2
       AND r.status IN ('accepted', 'in_progress', 'agreement')
     RETURNING id, referral_id, sender_id, kind, body, due_at, created_at`,
    [input.referralId, input.senderId, input.body, input.dueAt ?? null],
  );

  if (result.rowCount === 0) {
    const referral = await pool.query(
      `SELECT id, assigned_to, status
       FROM referrals
       WHERE id = $1`,
      [input.referralId],
    );

    if (referral.rowCount === 0) {
      throw new ReferralError(404, "REFERRAL_NOT_FOUND", "Referral not found");
    }

    if (referral.rows[0].assigned_to !== input.senderId) {
      throw new ReferralError(
        403,
        "REFERRAL_NOT_ASSIGNED",
        "You are not assigned to this referral",
      );
    }

    throw new ReferralError(
      409,
      "REFERRAL_NOT_OPEN",
      "Follow-ups are only allowed after a referral is accepted and before it is closed",
    );
  }

  return result.rows[0];
}

export async function getReferralFollowUps(input: {
  referralId: string;
  userId: string;
  isAdmin: boolean;
  page: number;
  limit: number;
}) {
  const referral = await pool.query(
    `SELECT id, assigned_to
     FROM referrals
     WHERE id = $1`,
    [input.referralId],
  );

  if (referral.rowCount === 0) {
    throw new ReferralError(404, "REFERRAL_NOT_FOUND", "Referral not found");
  }

  if (!input.isAdmin && referral.rows[0].assigned_to !== input.userId) {
    throw new ReferralError(
      403,
      "REFERRAL_NOT_ASSIGNED",
      "You are not assigned to this referral",
    );
  }

  const offset = (input.page - 1) * input.limit;

  const [countResult, result] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM referral_messages
       WHERE referral_id = $1 AND kind = 'follow_up'`,
      [input.referralId],
    ),
    pool.query(
      `SELECT
         rm.id,
         rm.referral_id,
         rm.sender_id,
         u.full_name AS sender_name,
         rm.body,
         rm.due_at,
         rm.created_at
       FROM referral_messages rm
       JOIN users u ON u.id = rm.sender_id
       WHERE rm.referral_id = $1
         AND rm.kind = 'follow_up'
       ORDER BY rm.created_at ASC, rm.id ASC
       LIMIT $2 OFFSET $3`,
      [input.referralId, input.limit, offset],
    ),
  ]);

  const total = countResult.rows[0].total;

  return {
    followUps: result.rows,
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}

// Send a message between the buyer and the assigned seller.
export async function createReferralMessage(input: {
  referralId: string;
  senderId: string;
  senderRole: "buyer" | "agent" | "developer";
  body: string;
}) {
  const result = await pool.query(
    `WITH target_referral AS MATERIALIZED (
       SELECT id, buyer_id, assigned_to
       FROM referrals
       WHERE id = $1
         AND (
           ($3 = 'buyer' AND buyer_id = $2)
           OR
           ($3 IN ('agent', 'developer') AND assigned_to = $2)
         )
         AND status IN ('assigned', 'accepted', 'in_progress', 'agreement')
       FOR UPDATE
     ),
     inserted_message AS (
       INSERT INTO referral_messages (
         referral_id,
         sender_id,
         kind,
         body
       )
       SELECT id, $2, 'message', $4
       FROM target_referral
       RETURNING id, referral_id, sender_id, kind, body, created_at
     )
     SELECT
       inserted_message.*,
       CASE
         WHEN $3 = 'buyer' THEN target_referral.assigned_to
         ELSE target_referral.buyer_id
       END AS recipient_id
     FROM inserted_message
     CROSS JOIN target_referral`,
    [input.referralId, input.senderId, input.senderRole, input.body],
  );

  if (result.rows.length === 0) {
    const referral = await pool.query(
      `SELECT id, buyer_id, assigned_to, status
       FROM referrals
       WHERE id = $1`,
      [input.referralId],
    );

    if (referral.rows.length === 0) {
      throw new ReferralError(404, "REFERRAL_NOT_FOUND", "Referral not found");
    }

    const currentReferral = referral.rows[0];

    if (
      input.senderRole === "buyer" &&
      currentReferral.buyer_id !== input.senderId
    ) {
      throw new ReferralError(
        403,
        "REFERRAL_ACCESS_DENIED",
        "You do not have access to this referral",
      );
    }

    if (
      ["agent", "developer"].includes(input.senderRole) &&
      currentReferral.assigned_to !== input.senderId
    ) {
      throw new ReferralError(
        403,
        "REFERRAL_NOT_ASSIGNED",
        "You are not assigned to this referral",
      );
    }

    throw new ReferralError(
      409,
      "REFERRAL_NOT_OPEN",
      "Messages cannot be sent for a rejected or closed referral",
    );
  }

  return result.rows[0];
}

// Retrieve messages for the buyer, assigned seller, or admin.
export async function getReferralMessages(input: {
  referralId: string;
  userId: string;
  isAdmin: boolean;
  page: number;
  limit: number;
}) {
  const referral = await pool.query(
    `SELECT id, buyer_id, assigned_to
     FROM referrals
     WHERE id = $1`,
    [input.referralId],
  );

  if (referral.rows.length === 0) {
    throw new ReferralError(404, "REFERRAL_NOT_FOUND", "Referral not found");
  }

  const currentReferral = referral.rows[0];

  if (
    !input.isAdmin &&
    currentReferral.buyer_id !== input.userId &&
    currentReferral.assigned_to !== input.userId
  ) {
    throw new ReferralError(
      403,
      "REFERRAL_ACCESS_DENIED",
      "You do not have access to this referral",
    );
  }

  const offset = (input.page - 1) * input.limit;

  const [countResult, result] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM referral_messages
       WHERE referral_id = $1
         AND kind = 'message'`,
      [input.referralId],
    ),

    pool.query(
      `SELECT
         rm.id,
         rm.referral_id,
         rm.sender_id,
         u.full_name AS sender_name,
         rm.body,
         rm.created_at
       FROM referral_messages rm
       JOIN users u ON u.id = rm.sender_id
       WHERE rm.referral_id = $1
         AND rm.kind = 'message'
       ORDER BY rm.created_at ASC, rm.id ASC
       LIMIT $2 OFFSET $3`,
      [input.referralId, input.limit, offset],
    ),
  ]);

  const total = countResult.rows[0].total;

  return {
    messages: result.rows,
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}

//issues and disputes related to a referral, visible to the assigned agent/developer and admin
type ReferralIssueReporterRole = "buyer" | "agent" | "developer";

type CreateReferralIssueInput = {
  referralId: string;
  reportedBy: string;
  reporterRole: ReferralIssueReporterRole;
  category: string;
  subject: string;
  description: string;
};

//referral issues and disputes
export async function createReferralIssue(input: CreateReferralIssueInput) {
  const result = await pool.query(
    `INSERT INTO referral_issues (
       referral_id,
       reported_by,
       category,
       subject,
       description
     )
     SELECT
       r.id,
       $2,
       $4,
       $5,
       $6
     FROM referrals r
     WHERE r.id = $1
       AND (
         ($3 = 'buyer' AND r.buyer_id = $2)
         OR
         ($3 IN ('agent', 'developer') AND r.assigned_to = $2)
       )
     RETURNING *`,
    [
      input.referralId,
      input.reportedBy,
      input.reporterRole,
      input.category,
      input.subject,
      input.description,
    ],
  );

  if (result.rows.length === 0) {
    const referral = await pool.query(
      `SELECT id, buyer_id, assigned_to
       FROM referrals
       WHERE id = $1`,
      [input.referralId],
    );

    if (referral.rows.length === 0) {
      throw new ReferralError(404, "REFERRAL_NOT_FOUND", "Referral not found");
    }

    throw new ReferralError(
      403,
      "REFERRAL_ACCESS_DENIED",
      "You are not authorized to report an issue for this referral",
    );
  }

  return result.rows[0];
}

const referralIssueAdminSelect = `
  SELECT
    ri.id,
    ri.referral_id,
    ri.reported_by,
    ri.category,
    ri.subject,
    ri.description,
    ri.status,
    ri.admin_notes,
    ri.resolution,
    ri.reviewed_by,
    ri.reviewed_at,
    ri.resolved_at,
    ri.created_at,
    ri.updated_at,

    r.reference_code,
    r.status AS referral_status,

    p.id AS property_id,
    p.title AS property_title,
    p.location AS property_location,
    p.status AS property_status,

    reporter.full_name AS reporter_name,
    reporter.email AS reporter_email,
    reporter.role AS reporter_role,

    COALESCE(
      buyer_profile.phone_number,
      agent_profile.phone_number,
      developer_profile.contact_phone
    ) AS reporter_phone,

    buyer.id AS buyer_id,
    buyer.full_name AS buyer_name,
    buyer.email AS buyer_email,

    assigned.id AS assigned_seller_id,
    assigned.full_name AS assigned_seller_name,
    assigned.email AS assigned_seller_email,
    assigned.role AS assigned_seller_role

  FROM referral_issues ri
  JOIN referrals r ON r.id = ri.referral_id
  JOIN properties p ON p.id = r.property_id
  JOIN users reporter ON reporter.id = ri.reported_by

  LEFT JOIN buyer_profiles buyer_profile
    ON buyer_profile.user_id = reporter.id

  LEFT JOIN agent_profiles agent_profile
    ON agent_profile.user_id = reporter.id

  LEFT JOIN developer_profiles developer_profile
    ON developer_profile.user_id = reporter.id

  JOIN users buyer ON buyer.id = r.buyer_id
  JOIN users assigned ON assigned.id = r.assigned_to
`;

// Retrieve referral issues reported by a specific user with pagination
export async function getMyReferralIssues(input: {
  userId: string;
  page: number;
  limit: number;
}) {
  const offset = (input.page - 1) * input.limit;

  const [issuesResult, countResult] = await Promise.all([
    pool.query(
      `SELECT
         ri.id,
         ri.referral_id,
         ri.category,
         ri.subject,
         ri.description,
         ri.status,
         ri.created_at,
         r.reference_code,
         p.title AS property_title
       FROM referral_issues ri
       JOIN referrals r ON r.id = ri.referral_id
       JOIN properties p ON p.id = r.property_id
       WHERE ri.reported_by = $1
       ORDER BY ri.created_at DESC
       LIMIT $2 OFFSET $3`,
      [input.userId, input.limit, offset],
    ),

    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM referral_issues
       WHERE reported_by = $1`,
      [input.userId],
    ),
  ]);

  const total = countResult.rows[0].total;

  return {
    issues: issuesResult.rows,
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}

// Admin view of all referral issues with optional status filter and pagination
export async function getAdminReferralIssues(input: {
  page: number;
  limit: number;
  status?: string;
}) {
  const offset = (input.page - 1) * input.limit;

  const [issuesResult, countResult] = await Promise.all([
    pool.query(
      `${referralIssueAdminSelect}
       WHERE ($1::text IS NULL OR ri.status = $1)
       ORDER BY ri.created_at DESC
       LIMIT $2 OFFSET $3`,
      [input.status ?? null, input.limit, offset],
    ),

    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM referral_issues
       WHERE ($1::text IS NULL OR status = $1)`,
      [input.status ?? null],
    ),
  ]);

  const total = countResult.rows[0].total;

  return {
    issues: issuesResult.rows,
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}

// Admin view of a specific referral issue by its ID
export async function getAdminReferralIssueById(issueId: string) {
  const result = await pool.query(
    `${referralIssueAdminSelect}
     WHERE ri.id = $1`,
    [issueId],
  );

  if (result.rows.length === 0) {
    throw new ReferralError(
      404,
      "REFERRAL_ISSUE_NOT_FOUND",
      "Referral issue report not found",
    );
  }

  return result.rows[0];
}

// Admin updates the status, notes, and resolution of a referral issue
export async function updateReferralIssue(input: {
  issueId: string;
  adminId: string;
  status?: string;
  adminNotes?: string | null;
  resolution?: string | null;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      `SELECT id, status, resolution
       FROM referral_issues
       WHERE id = $1
       FOR UPDATE`,
      [input.issueId],
    );

    const existing = existingResult.rows[0];

    if (!existing) {
      throw new ReferralError(
        404,
        "REFERRAL_ISSUE_NOT_FOUND",
        "Referral issue report not found",
      );
    }

    const transitions: Record<string, string[]> = {
      open: ["under_review", "dismissed", "resolved"],
      under_review: ["resolved", "dismissed"],
      resolved: [],
      dismissed: [],
    };

    if (
      input.status &&
      input.status !== existing.status &&
      !transitions[existing.status]?.includes(input.status)
    ) {
      throw new ReferralError(
        400,
        "INVALID_ISSUE_STATUS_TRANSITION",
        `Cannot change report status from ${existing.status} to ${input.status}`,
      );
    }

    const nextStatus = input.status ?? existing.status;

    const nextResolution =
      input.resolution !== undefined ? input.resolution : existing.resolution;

    if (nextStatus === "resolved" && !nextResolution?.trim()) {
      throw new ReferralError(
        400,
        "RESOLUTION_REQUIRED",
        "A resolution is required when resolving a report",
      );
    }

    const result = await client.query(
      `UPDATE referral_issues
       SET
         status = $2,
         admin_notes = CASE
           WHEN $3::boolean THEN $4
           ELSE admin_notes
         END,
         resolution = CASE
           WHEN $5::boolean THEN $6
           ELSE resolution
         END,
         reviewed_by = CASE
           WHEN $2 = 'under_review' AND reviewed_by IS NULL
           THEN $7
           ELSE reviewed_by
         END,
         reviewed_at = CASE
           WHEN $2 = 'under_review' AND reviewed_at IS NULL
           THEN NOW()
           ELSE reviewed_at
         END,
         resolved_at = CASE
           WHEN $2 = 'resolved' THEN COALESCE(resolved_at, NOW())
           WHEN $2 = 'open' THEN NULL
           ELSE resolved_at
         END,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        input.issueId,
        nextStatus,
        input.adminNotes !== undefined,
        input.adminNotes ?? null,
        input.resolution !== undefined,
        input.resolution ?? null,
        input.adminId,
      ],
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
