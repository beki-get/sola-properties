import type { PoolClient } from "pg";

interface WriteAuditLogInput {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: unknown | null;
  newValues?: unknown | null;
}

export async function writeAuditLog(
  client: PoolClient,
  input: WriteAuditLogInput,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (
       actor_id,
       action,
       entity_type,
       entity_id,
       old_values,
       new_values
     )
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.actorId,
      input.action,
      input.entityType,
      input.entityId,
      input.oldValues == null ? null : JSON.stringify(input.oldValues),
      input.newValues == null ? null : JSON.stringify(input.newValues),
    ],
  );
}