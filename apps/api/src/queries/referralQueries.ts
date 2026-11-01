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
