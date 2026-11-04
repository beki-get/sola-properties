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

  if (
    !input.isAdmin &&
    referral.rows[0].assigned_to !== input.userId
  ) {
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