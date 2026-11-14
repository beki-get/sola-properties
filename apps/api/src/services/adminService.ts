import {
  findAuditLogs,
  findUserByEmailAdmin,
  findUserByIdDetail,
  findUsers,
  findUserForStatusUpdate,
  insertAdminUser,
  updateUserStatusByAdmin,
  revokeUserRefreshTokens,
  findLatestVerificationRequestStatus,
  findPropertyLookupById,
  listPropertyLookupsQuery,
  insertPropertyLookup,
  updatePropertyLookupRecord,
  findUsersForExport,
} from "../queries/adminQueries";
import type {
  AdminPropertyLookupCreateInput,
  AdminPropertyLookupUpdateInput,
  AdminUserCreateInput,
  AdminUserListFilters,
  AdminUserStatusUpdateInput,
  AuditLogFilters,
} from "../schemas/adminSchemas";
import { withTransaction } from "../utils/withTransaction";
import { writeAuditLog } from "../utils/auditLog";
import { hashPassword } from "../utils/password";
import { createNotification } from "../queries/notificationQueries";
import { logger } from "../utils/logger";
import { generateCsv } from "../utils/csv";

const lookupTableMap = {
  category: "property_categories",
  location: "property_locations",
} as const;

const lookupEntityMap = {
  category: "property_category",
  location: "property_location",
} as const;

export async function listPropertyLookups(
  kind: "category" | "location",
  options: { includeInactive?: boolean } = {},
) {
  return listPropertyLookupsQuery(kind, options.includeInactive === true);
}

export async function createPropertyLookup(
  kind: "category" | "location",
  input: AdminPropertyLookupCreateInput,
  actingUserId: string,
) {
  const entityType = lookupEntityMap[kind];

  return withTransaction(async (client) => {
    const created = await insertPropertyLookup(kind, input, client);

    await writeAuditLog(client, {
      actorId: actingUserId,
      action: `${entityType}.created`,
      entityType,
      entityId: created.id,
      oldValues: null,
      newValues: {
        name: created.name,
        isActive: created.isActive,
      },
    });

    return created;
  });
}

export async function updatePropertyLookupEntry(
  kind: "category" | "location",
  lookupId: string,
  input: AdminPropertyLookupUpdateInput,
  actingUserId: string,
) {
  const entityType = lookupEntityMap[kind];

  return withTransaction(async (client) => {
    const existing = await findPropertyLookupById(kind, lookupId, client);

    if (!existing) {
      throw new AdminUserServiceError(
        404,
        "LOOKUP_NOT_FOUND",
        "Record not found",
      );
    }

    const updates: Partial<{ name: string; is_active: boolean }> = {};

    if (input.name !== undefined) {
      updates.name = input.name;
    }

    if (input.isActive !== undefined) {
      updates.is_active = input.isActive;
    }

    if (Object.keys(updates).length === 0) {
      return existing;
    }

    const result = await updatePropertyLookupRecord(
      kind,
      lookupId,
      updates,
      client,
    );

    await writeAuditLog(client, {
      actorId: actingUserId,
      action: `${entityType}.updated`,
      entityType,
      entityId: lookupId,
      oldValues: {
        name: existing.name,
        isActive: existing.isActive,
      },
      newValues: {
        name: result.name,
        isActive: result.isActive,
      },
    });

    return result;
  });
}

const adminUserStatusTransitions: Record<
  "pending" | "approved" | "rejected" | "suspended" | "deactivated",
  { suspend?: boolean; deactivate?: boolean; reactivate?: boolean }
> = {
  pending: { suspend: true, deactivate: true },
  approved: { suspend: true, deactivate: true },
  rejected: { deactivate: true },
  suspended: { reactivate: true, deactivate: true },
  deactivated: {},
};

export class AdminUserServiceError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AdminUserServiceError";
  }
}

export async function createAdminUser(
  input: AdminUserCreateInput,
  actingUserId: string,
) {
  const existingUser = await findUserByEmailAdmin(input.email);

  if (existingUser) {
    throw new AdminUserServiceError(
      409,
      "EMAIL_ALREADY_REGISTERED",
      "An account with this email already exists",
    );
  }

  const passwordHash = await hashPassword(input.password);

  const result = await withTransaction(async (client) => {
    const createdUser = await insertAdminUser(
      {
        fullName: input.fullName,
        email: input.email,
        passwordHash,
        role: input.role,
        phone: input.phone,
      },
      client,
    );

    await writeAuditLog(client, {
      actorId: actingUserId,
      action: "admin.user_created",
      entityType: "user",
      entityId: createdUser.id,
      oldValues: null,
      newValues: {
        id: createdUser.id,
        fullName: createdUser.full_name,
        email: createdUser.email,
        role: createdUser.role,
        status: createdUser.status,
        emailVerifiedAt: createdUser.email_verified_at,
        phone: input.phone,
      },
    });

    return {
      id: createdUser.id,
      fullName: createdUser.full_name,
      email: createdUser.email,
      phone: input.phone,
      role: createdUser.role,
      status: createdUser.status,
      emailVerifiedAt: createdUser.email_verified_at,
      createdAt: createdUser.created_at,
      updatedAt: createdUser.updated_at,
    };
  });

  return result;
}

export async function getAuditLogs(filters: AuditLogFilters) {
  const result = await findAuditLogs(filters);

  return {
    logs: result.logs,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / filters.limit),
    },
  };
}

//get all users for admin
export async function getUsers(filters: AdminUserListFilters) {
  const result = await findUsers(filters);

  return {
    data: result.users,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / filters.limit),
    },
  };
}

//export all users for admin
export async function exportUsers(filters: AdminUserListFilters) {
  const users = await findUsersForExport(filters);

  const headers = [
    "User ID",
    "Full Name",
    "Email",
    "Phone",
    "Role",
    "Account Status",
    "Email Verified At",
    "Registration Date",
  ];

  const rows = users.map((user) => [
    user.id,
    user.fullName,
    user.email,
    user.phone,
    user.role,
    user.status,
    user.emailVerifiedAt?.toISOString() ?? "",
    user.createdAt.toISOString(),
  ]);

  return generateCsv(headers, rows);
}

//get user by id for admin
export async function getUserById(userId: string) {
  const user = await findUserByIdDetail(userId);

  if (!user) {
    throw new AdminUserServiceError(404, "USER_NOT_FOUND", "User not found");
  }

  return user;
}

//
export async function updateUserStatus(
  targetUserId: string,
  input: AdminUserStatusUpdateInput,
  actingUserId: string,
  actingUserRole: "admin" | "finance_admin",
) {
  if (targetUserId === actingUserId) {
    throw new AdminUserServiceError(
      403,
      "SELF_STATUS_CHANGE_FORBIDDEN",
      "Administrators cannot change their own account status",
    );
  }

  if (actingUserRole !== "admin") {
    throw new AdminUserServiceError(
      403,
      "ROLE_NOT_ALLOWED",
      "Only admins can manage account status",
    );
  }

  const statusResult = await withTransaction(async (client) => {
    const targetUser = await findUserForStatusUpdate(targetUserId, client);

    if (!targetUser) {
      throw new AdminUserServiceError(404, "USER_NOT_FOUND", "User not found");
    }

    const allowed = adminUserStatusTransitions[targetUser.status];
    const requested = input.action;

    if (requested === "suspend" && !allowed.suspend) {
      throw new AdminUserServiceError(
        409,
        "INVALID_STATUS_TRANSITION",
        requested === "suspend" && targetUser.status === "suspended"
          ? "User is already suspended"
          : `User cannot be suspended from status '${targetUser.status}'`,
      );
    }

    if (requested === "deactivate" && !allowed.deactivate) {
      throw new AdminUserServiceError(
        409,
        "INVALID_STATUS_TRANSITION",
        requested === "deactivate" && targetUser.status === "deactivated"
          ? "User is already deactivated"
          : `User cannot be deactivated from status '${targetUser.status}'`,
      );
    }

    if (requested === "reactivate" && !allowed.reactivate) {
      throw new AdminUserServiceError(
        409,
        "INVALID_STATUS_TRANSITION",
        requested === "reactivate" && targetUser.status === "approved"
          ? "User is already active"
          : `User cannot be reactivated from status '${targetUser.status}'`,
      );
    }

    let nextStatus: "approved" | "suspended" | "deactivated" | "pending";

    if (requested === "suspend") {
      nextStatus = "suspended";
    } else if (requested === "deactivate") {
      nextStatus = "deactivated";
    } else {
      if (
        targetUser.role === "buyer" ||
        targetUser.role === "admin" ||
        targetUser.role === "finance_admin"
      ) {
        nextStatus = "approved";
      } else {
        const latestVerificationStatus =
          await findLatestVerificationRequestStatus(targetUser.id, client);

        nextStatus =
          latestVerificationStatus === "approved" ? "approved" : "pending";
      }
    }

    const oldStatus = targetUser.status;

    if (requested === "suspend" || requested === "deactivate") {
      await revokeUserRefreshTokens(targetUser.id, client);
    }

    const updatedUser = await updateUserStatusByAdmin(
      targetUser.id,
      nextStatus,
      client,
    );

    await writeAuditLog(client, {
      actorId: actingUserId,
      action: "user.status_changed",
      entityType: "user",
      entityId: targetUser.id,
      oldValues: { status: oldStatus },
      newValues: {
        status: nextStatus,
        action: requested,
        reason: input.reason ?? null,
      },
    });

    return {
      id: updatedUser.id,
      fullName: updatedUser.full_name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      role: updatedUser.role,
      status: updatedUser.status,
      emailVerifiedAt: updatedUser.email_verified_at,
      createdAt: updatedUser.created_at,
      updatedAt: updatedUser.updated_at,
    };
  });

  try {
    await createNotification({
      recipientId: targetUserId,
      type: "account_status_changed",
      title: "Account status updated",
      message:
        statusResult.status === "suspended"
          ? "Your account has been suspended."
          : statusResult.status === "deactivated"
            ? "Your account has been deactivated."
            : statusResult.status === "pending"
              ? "Your account has been reactivated with a pending review status."
              : "Your account has been reactivated successfully.",
      entityType: "user",
      entityId: targetUserId,
    });
  } catch (error) {
    logger.warn(
      { err: error, targetUserId },
      "Failed to create account status change notification",
    );
  }

  return statusResult;
}
