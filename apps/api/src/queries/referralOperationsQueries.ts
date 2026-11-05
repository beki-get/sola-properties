import { pool } from "../config/database.js";

export class ReferralOperationError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "ReferralOperationError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const eligibleReferralStatuses = ["accepted", "in_progress", "agreement"];

async function getReferralForBuyer(
  referralId: string,
  buyerId: string,
  client: typeof pool | any = pool,
) {
  const result = await client.query(
    `SELECT id, buyer_id, assigned_to, status
     FROM referrals
     WHERE id = $1`,
    [referralId],
  );

  if (result.rowCount === 0) {
    throw new ReferralOperationError(
      404,
      "REFERRAL_NOT_FOUND",
      "Referral not found",
    );
  }

  const referral = result.rows[0];

  if (referral.buyer_id !== buyerId) {
    throw new ReferralOperationError(
      403,
      "REFERRAL_ACCESS_DENIED",
      "You do not have access to this referral",
    );
  }

  if (!eligibleReferralStatuses.includes(referral.status)) {
    throw new ReferralOperationError(
      409,
      "REFERRAL_NOT_ELIGIBLE",
      "A visit can only be requested for an accepted or in-progress referral",
    );
  }

  return referral;
}

async function getAssignedReferral(
  referralId: string,
  sellerId: string,
  client: typeof pool | any = pool,
) {
  const result = await client.query(
    `SELECT id, buyer_id, assigned_to, status
     FROM referrals
     WHERE id = $1`,
    [referralId],
  );

  if (result.rowCount === 0) {
    throw new ReferralOperationError(
      404,
      "REFERRAL_NOT_FOUND",
      "Referral not found",
    );
  }

  const referral = result.rows[0];

  if (referral.assigned_to !== sellerId) {
    throw new ReferralOperationError(
      403,
      "REFERRAL_ACCESS_DENIED",
      "You are not assigned to this referral",
    );
  }

  if (!eligibleReferralStatuses.includes(referral.status)) {
    throw new ReferralOperationError(
      409,
      "REFERRAL_NOT_ELIGIBLE",
      "This referral cannot have active property visits",
    );
  }

  return referral;
}

async function getVisitForParticipant(
  visitId: string,
  userId: string,
  client: typeof pool | any = pool,
) {
  const result = await client.query(
    `SELECT
       pv.*,
       r.buyer_id,
       r.assigned_to,
       r.status AS referral_status
     FROM property_visits pv
     JOIN referrals r ON r.id = pv.referral_id
     WHERE pv.id = $1`,
    [visitId],
  );

  if (result.rowCount === 0) {
    throw new ReferralOperationError(
      404,
      "VISIT_NOT_FOUND",
      "Property visit not found",
    );
  }

  const visit = result.rows[0];

  if (visit.buyer_id !== userId && visit.assigned_to !== userId) {
    throw new ReferralOperationError(
      403,
      "VISIT_ACCESS_DENIED",
      "You do not have access to this visit",
    );
  }

  return visit;
}

export async function createBuyerVisitRequest(
  buyerId: string,
  referralId: string,
  data: {
    requestedAt: string;
    location?: string;
    notes?: string;
  },
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const referralResult = await client.query(
      `SELECT id, buyer_id, status
       FROM referrals
       WHERE id = $1
       FOR UPDATE`,
      [referralId],
    );

    if (referralResult.rowCount === 0) {
      throw new ReferralOperationError(
        404,
        "REFERRAL_NOT_FOUND",
        "Referral not found",
      );
    }

    const referral = referralResult.rows[0];

    if (referral.buyer_id !== buyerId) {
      throw new ReferralOperationError(
        403,
        "REFERRAL_ACCESS_DENIED",
        "You do not have access to this referral",
      );
    }

    if (!eligibleReferralStatuses.includes(referral.status)) {
      throw new ReferralOperationError(
        409,
        "REFERRAL_NOT_ELIGIBLE",
        "A visit can only be requested for an accepted or in-progress referral",
      );
    }

    const existingVisit = await client.query(
      `SELECT id
       FROM property_visits
       WHERE referral_id = $1
         AND status IN ('requested', 'scheduled')
       LIMIT 1`,
      [referralId],
    );

    if (existingVisit.rows.length > 0) {
      throw new ReferralOperationError(
        409,
        "ACTIVE_VISIT_EXISTS",
        "An active visit already exists for this referral",
      );
    }

    const result = await client.query(
      `INSERT INTO property_visits (
         referral_id,
         requested_at,
         location,
         notes,
         created_by
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        referralId,
        data.requestedAt,
        data.location ?? null,
        data.notes ?? null,
        buyerId,
      ],
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ReferralOperationError(
        409,
        "ACTIVE_VISIT_EXISTS",
        "An active visit already exists for this referral",
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function getBuyerVisits(
  buyerId: string,
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;

  const [visits, count] = await Promise.all([
    pool.query(
      `SELECT
         pv.*,
         r.reference_code,
         p.title AS property_title
       FROM property_visits pv
       JOIN referrals r ON r.id = pv.referral_id
       JOIN properties p ON p.id = r.property_id
       WHERE r.buyer_id = $1
       ORDER BY pv.created_at DESC, pv.id DESC
       LIMIT $2 OFFSET $3`,
      [buyerId, limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM property_visits pv
       JOIN referrals r ON r.id = pv.referral_id
       WHERE r.buyer_id = $1`,
      [buyerId],
    ),
  ]);

  return {
    visits: visits.rows,
    pagination: {
      page,
      limit,
      total: count.rows[0].total,
      totalPages: Math.ceil(count.rows[0].total / limit),
    },
  };
}

export async function getSellerVisits(
  referralId: string,
  sellerId: string,
  page: number,
  limit: number,
) {
  await getAssignedReferral(referralId, sellerId);

  const offset = (page - 1) * limit;

  const [visits, count] = await Promise.all([
    pool.query(
      `SELECT pv.*
       FROM property_visits pv
       WHERE pv.referral_id = $1
       ORDER BY pv.created_at DESC, pv.id DESC
       LIMIT $2 OFFSET $3`,
      [referralId, limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM property_visits
       WHERE referral_id = $1`,
      [referralId],
    ),
  ]);

  return {
    visits: visits.rows,
    pagination: {
      page,
      limit,
      total: count.rows[0].total,
      totalPages: Math.ceil(count.rows[0].total / limit),
    },
  };
}

export async function schedulePropertyVisit(
  visitId: string,
  sellerId: string,
  data: {
    scheduledAt: string;
    location?: string;
    notes?: string;
  },
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const visitResult = await client.query(
      `SELECT pv.*, r.assigned_to, r.status AS referral_status
       FROM property_visits pv
       JOIN referrals r ON r.id = pv.referral_id
       WHERE pv.id = $1
       FOR UPDATE OF pv, r`,
      [visitId],
    );

    if (visitResult.rowCount === 0) {
      throw new ReferralOperationError(
        404,
        "VISIT_NOT_FOUND",
        "Property visit not found",
      );
    }

    const visit = visitResult.rows[0];

    if (visit.assigned_to !== sellerId) {
      throw new ReferralOperationError(
        403,
        "VISIT_ACCESS_DENIED",
        "You are not assigned to this referral",
      );
    }

    if (!eligibleReferralStatuses.includes(visit.referral_status)) {
      throw new ReferralOperationError(
        409,
        "REFERRAL_NOT_ELIGIBLE",
        "This referral cannot be scheduled",
      );
    }

    if (visit.status !== "requested") {
      throw new ReferralOperationError(
        409,
        "VISIT_NOT_REQUESTED",
        "Only requested visits can be scheduled",
      );
    }

    const result = await client.query(
      `UPDATE property_visits
       SET scheduled_at = $2,
           location = COALESCE($3, location),
           notes = COALESCE($4, notes),
           status = 'scheduled',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [visitId, data.scheduledAt, data.location ?? null, data.notes ?? null],
    );

    await client.query("COMMIT");
    return result.rows[0];
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

export async function updatePropertyVisit(
  visitId: string,
  sellerId: string,
  data: {
    scheduledAt?: string;
    location?: string | null;
    notes?: string | null;
  },
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const visitResult = await client.query(
      `SELECT pv.*, r.assigned_to, r.status AS referral_status
       FROM property_visits pv
       JOIN referrals r ON r.id = pv.referral_id
       WHERE pv.id = $1
       FOR UPDATE OF pv, r`,
      [visitId],
    );

    if (visitResult.rowCount === 0) {
      throw new ReferralOperationError(
        404,
        "VISIT_NOT_FOUND",
        "Property visit not found",
      );
    }

    const visit = visitResult.rows[0];

    if (visit.assigned_to !== sellerId) {
      throw new ReferralOperationError(
        403,
        "VISIT_ACCESS_DENIED",
        "You are not assigned to this referral",
      );
    }

    if (!eligibleReferralStatuses.includes(visit.referral_status)) {
      throw new ReferralOperationError(
        409,
        "REFERRAL_NOT_ELIGIBLE",
        "This referral cannot be updated",
      );
    }

    if (visit.status !== "scheduled") {
      throw new ReferralOperationError(
        409,
        "VISIT_NOT_EDITABLE",
        "Only scheduled visits can be updated",
      );
    }

    const result = await client.query(
      `UPDATE property_visits
       SET scheduled_at = COALESCE($2, scheduled_at),
           location = CASE WHEN $3::boolean THEN $4 ELSE location END,
           notes = CASE WHEN $5::boolean THEN $6 ELSE notes END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        visitId,
        data.scheduledAt ?? null,
        data.location !== undefined,
        data.location ?? null,
        data.notes !== undefined,
        data.notes ?? null,
      ],
    );

    await client.query("COMMIT");
    return result.rows[0];
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

export async function cancelPropertyVisit(visitId: string, userId: string) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const visit = await getVisitForParticipant(visitId, userId, client);

    if (!["requested", "scheduled"].includes(visit.status)) {
      throw new ReferralOperationError(
        409,
        "VISIT_NOT_CANCELLABLE",
        "Only requested or scheduled visits can be cancelled",
      );
    }

    const result = await client.query(
      `UPDATE property_visits
       SET status = 'cancelled',
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [visitId],
    );

    await client.query("COMMIT");
    return result.rows[0];
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

export async function recordPropertyVisitOutcome(
  visitId: string,
  sellerId: string,
  data: {
    outcome: "interested" | "not_interested" | "requested_another_visit";
    outcomeNote?: string;
  },
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const visitResult = await client.query(
      `SELECT pv.*, r.assigned_to
       FROM property_visits pv
       JOIN referrals r ON r.id = pv.referral_id
       WHERE pv.id = $1
       FOR UPDATE OF pv, r`,
      [visitId],
    );

    if (visitResult.rowCount === 0) {
      throw new ReferralOperationError(
        404,
        "VISIT_NOT_FOUND",
        "Property visit not found",
      );
    }

    const visit = visitResult.rows[0];

    if (visit.assigned_to !== sellerId) {
      throw new ReferralOperationError(
        403,
        "VISIT_ACCESS_DENIED",
        "You are not assigned to this referral",
      );
    }

    if (visit.status === "cancelled") {
      throw new ReferralOperationError(
        409,
        "VISIT_CANCELLED",
        "Cannot record an outcome for a cancelled visit",
      );
    }

    if (visit.status === "requested") {
      throw new ReferralOperationError(
        409,
        "VISIT_NOT_SCHEDULED",
        "The visit must be scheduled before recording its outcome",
      );
    }

    if (new Date(visit.scheduled_at).getTime() > Date.now()) {
      throw new ReferralOperationError(
        409,
        "VISIT_NOT_YET_HELD",
        "The visit date and time have not arrived yet",
      );
    }

    const history = Array.isArray(visit.outcome_history)
      ? visit.outcome_history
      : [];

    if (visit.outcome) {
      history.push({
        outcome: visit.outcome,
        outcomeNote: visit.outcome_note,
        recordedBy: visit.outcome_recorded_by,
        recordedAt: visit.outcome_recorded_at,
      });
    }

    const result = await client.query(
      `UPDATE property_visits
       SET outcome = $2,
           outcome_note = $3,
           outcome_recorded_by = $4,
           outcome_recorded_at = NOW(),
           outcome_history = $5::jsonb,
           status = 'completed',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        visitId,
        data.outcome,
        data.outcomeNote ?? null,
        sellerId,
        JSON.stringify(history),
      ],
    );

    await client.query("COMMIT");
    return result.rows[0];
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
