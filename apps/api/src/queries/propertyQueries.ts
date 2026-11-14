import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "../config/database";
import type {
  CreatePropertyInput,
  UpdatePropertyInput,
  PropertyListQuery,
  PublicPropertyListQuery,
  AdminPendingPropertyListQuery,
  AdminPropertyDecisionInput,
} from "../schemas/propertySchemas";
import { writeAuditLog } from "../utils/auditLog";

export type PropertyStatus =
  "draft" | "pending_approval" | "active" | "inactive" | "sold" | "rejected";

export interface Property extends QueryResultRow {
  id: string;
  owner_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  category_id: string;
  location_id: string;
  category_name?: string;
  location_name?: string;
  size_sqm: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  features: string[];
  price: string | null;
  payment_plan: string | null;
  status: PropertyStatus;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export class PropertyQueryError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "PropertyQueryError";
  }
}

async function getClientProperty(
  client: PoolClient,
  propertyId: string,
  ownerId: string,
  lock = false,
): Promise<Property> {
  const result = await client.query<Property>(
    `SELECT * FROM properties
     WHERE id = $1 AND owner_id = $2
     ${lock ? "FOR UPDATE" : ""}`,
    [propertyId, ownerId],
  );

  if (!result.rows[0]) {
    throw new PropertyQueryError(
      404,
      "PROPERTY_NOT_FOUND",
      "Property not found",
    );
  }

  return result.rows[0];
}

async function verifyProject(
  client: PoolClient,
  projectId: string | null | undefined,
  developerId: string,
) {
  if (!projectId) return;

  const result = await client.query(
    `SELECT id FROM projects
     WHERE id = $1 AND developer_id = $2`,
    [projectId, developerId],
  );

  if (result.rowCount === 0) {
    throw new PropertyQueryError(
      400,
      "INVALID_PROJECT",
      "Project does not exist or does not belong to you",
    );
  }
}

export async function createProperty(
  ownerId: string,
  role: "agent" | "developer",
  input: CreatePropertyInput,
): Promise<Property> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (input.project_id && role !== "developer") {
      throw new PropertyQueryError(
        403,
        "PROJECT_NOT_ALLOWED",
        "Only developers can associate properties with projects",
      );
    }

    if (role === "developer") {
      await verifyProject(client, input.project_id, ownerId);
    }

    const result = await client.query<Property>(
      `INSERT INTO properties (
         owner_id, project_id, title, description, category_id, location_id, size_sqm, bedrooms, bathrooms, features,
         price, payment_plan, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
               'pending_approval')
       RETURNING *`,
      [
        ownerId,
        input.project_id ?? null,
        input.title,
        input.description ?? null,
        input.category_id,
        input.location_id,
        input.size_sqm ?? null,
        input.bedrooms ?? null,
        input.bathrooms ?? null,
        input.features,
        input.price,
        input.payment_plan,
      ],
    );

    const property = result.rows[0]!;

    await writeAuditLog(client, {
      actorId: ownerId,
      action: "property.created",
      entityType: "property",
      entityId: property.id,
      oldValues: null,
      newValues: {
        title: property.title,
        project_id: property.project_id,
        status: property.status,
      },
    });

    await client.query("COMMIT");
    return property;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listMyProperties(
  ownerId: string,
  query: PropertyListQuery,
) {
  const offset = (query.page - 1) * query.limit;

  const result = await pool.query<Property>(
    `SELECT
    p.*,
    c.name AS category_name,
    l.name AS location_name
FROM properties p
JOIN property_categories c ON c.id = p.category_id
JOIN property_locations l ON l.id = p.location_id
WHERE p.owner_id = $1
  AND ($2::property_status IS NULL OR p.status = $2)
ORDER BY p.created_at DESC
LIMIT $3 OFFSET $4`,
    [ownerId, query.status ?? null, query.limit, offset],
  );

  const count = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM properties
     WHERE owner_id = $1
       AND ($2::property_status IS NULL OR status = $2)`,
    [ownerId, query.status ?? null],
  );

  return {
    items: result.rows,
    page: query.page,
    limit: query.limit,
    total: Number(count.rows[0]?.count ?? 0),
  };
}

export async function getMyProperty(
  ownerId: string,
  propertyId: string,
): Promise<Property> {
  const result = await pool.query<Property>(
    `SELECT
    p.*,
    c.name AS category_name,
    l.name AS location_name
FROM properties p
JOIN property_categories c ON c.id = p.category_id
JOIN property_locations l ON l.id = p.location_id
WHERE p.id = $1 AND p.owner_id = $2`,
    [propertyId, ownerId],
  );

  if (!result.rows[0]) {
    throw new PropertyQueryError(
      404,
      "PROPERTY_NOT_FOUND",
      "Property not found",
    );
  }

  return result.rows[0];
}

export async function updateMyProperty(
  ownerId: string,
  role: "agent" | "developer",
  propertyId: string,
  input: UpdatePropertyInput,
): Promise<Property> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await getClientProperty(client, propertyId, ownerId, true);

    if (!["draft", "pending_approval"].includes(current.status)) {
      throw new PropertyQueryError(
        409,
        "PROPERTY_NOT_EDITABLE",
        "Only draft or pending-approval properties can be edited",
      );
    }

    if (input.project_id && role !== "developer") {
      throw new PropertyQueryError(
        403,
        "PROJECT_NOT_ALLOWED",
        "Only developers can associate properties with projects",
      );
    }

    if (role === "developer" && input.project_id) {
      await verifyProject(client, input.project_id, ownerId);
    }

    if (input.category_id !== undefined) {
      const category = await client.query(
        `SELECT id FROM property_categories
     WHERE id = $1 AND is_active = TRUE`,
        [input.category_id],
      );

      if (category.rowCount === 0) {
        throw new PropertyQueryError(
          400,
          "INVALID_PROPERTY_CATEGORY",
          "Property category does not exist or is inactive",
        );
      }
    }

    if (input.location_id !== undefined) {
      const location = await client.query(
        `SELECT id FROM property_locations
     WHERE id = $1 AND is_active = TRUE`,
        [input.location_id],
      );

      if (location.rowCount === 0) {
        throw new PropertyQueryError(
          400,
          "INVALID_PROPERTY_LOCATION",
          "Property location does not exist or is inactive",
        );
      }
    }

    const fields: Array<keyof UpdatePropertyInput> = [
      "title",
      "description",
      "category_id",
      "location_id",
      "size_sqm",
      "bedrooms",
      "bathrooms",
      "features",
      "price",
      "payment_plan",
      "project_id",
    ];

    const changes: string[] = [];
    const values: unknown[] = [];

    for (const field of fields) {
      if (input[field] !== undefined) {
        values.push(input[field]);
        changes.push(`${field} = $${values.length}`);
      }
    }

    values.push(propertyId, ownerId);

    const result = await client.query<Property>(
      `UPDATE properties
       SET ${changes.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length - 1}
         AND owner_id = $${values.length}
       RETURNING *`,
      values,
    );

    const updatedResult = await client.query<Property>(
      `SELECT p.*, c.name AS category_name, l.name AS location_name
   FROM properties p
   JOIN property_categories c ON c.id = p.category_id
   JOIN property_locations l ON l.id = p.location_id
   WHERE p.id = $1`,
      [propertyId],
    );

    const updated = updatedResult.rows[0]!;
    await writeAuditLog(client, {
      actorId: ownerId,
      action: "property.updated",
      entityType: "property",
      entityId: propertyId,
      oldValues: {
        title: current.title,
        description: current.description,
        category_id: current.category_id,
        location_id: current.location_id,
        size_sqm: current.size_sqm,
        bedrooms: current.bedrooms,
        bathrooms: current.bathrooms,
        features: current.features,
        price: current.price,
        payment_plan: current.payment_plan,
        project_id: current.project_id,
        status: current.status,
      },
      newValues: {
        title: updated.title,
        description: updated.description,
        category_id: updated.category_id,
        location_id: updated.location_id,
        size_sqm: updated.size_sqm,
        bedrooms: updated.bedrooms,
        bathrooms: updated.bathrooms,
        features: updated.features,
        price: updated.price,
        payment_plan: updated.payment_plan,
        project_id: updated.project_id,
        status: updated.status,
      },
    });

    await client.query("COMMIT");
    return updated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

//property status updating function for a property owner.
export async function changeMyPropertyStatus(
  ownerId: string,
  propertyId: string,
  status: "inactive" | "sold",
): Promise<Property> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await getClientProperty(client, propertyId, ownerId, true);

    const allowed =
      (current.status === "active" && ["inactive", "sold"].includes(status)) ||
      (current.status === "inactive" && status === "sold");

    if (!allowed) {
      throw new PropertyQueryError(
        409,
        "INVALID_PROPERTY_STATUS_TRANSITION",
        "This property cannot transition to the requested status",
      );
    }

    const result = await client.query<Property>(
      `UPDATE properties SET status = $1, updated_at = NOW()
       WHERE id = $2 AND owner_id = $3 RETURNING *`,
      [status, propertyId, ownerId],
    );

    const updated = result.rows[0]!;

    await writeAuditLog(client, {
      actorId: ownerId,
      action: "property.status_changed",
      entityType: "property",
      entityId: propertyId,
      oldValues: { status: current.status },
      newValues: { status: updated.status },
    });

    await client.query("COMMIT");
    return updated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export interface PropertyImage extends QueryResultRow {
  id: string;
  property_id: string;
  storage_key: string;
  original_filename: string;
  mime_type: "image/jpeg" | "image/png" | "image/webp";
  file_size: number;
  is_primary: boolean;
  display_order: number;
  created_at: Date;
}

export interface NewPropertyImage {
  storageKey: string;
  originalFilename: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  fileSize: number;
}

export async function insertPropertyImages(
  ownerId: string,
  propertyId: string,
  images: NewPropertyImage[],
): Promise<PropertyImage[]> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const propertyResult = await client.query<{
      id: string;
      status: PropertyStatus;
    }>(
      `SELECT id, status FROM properties
       WHERE id = $1 AND owner_id = $2
       FOR UPDATE`,
      [propertyId, ownerId],
    );

    const property = propertyResult.rows[0];

    if (!property) {
      throw new PropertyQueryError(
        404,
        "PROPERTY_NOT_FOUND",
        "Property not found",
      );
    }

    if (!["draft", "pending_approval"].includes(property.status)) {
      throw new PropertyQueryError(
        409,
        "PROPERTY_IMAGES_LOCKED",
        "Images can only be changed on draft or pending-approval properties",
      );
    }

    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count
   FROM property_images
   WHERE property_id = $1`,
      [propertyId],
    );

    const existingCount = Number(countResult.rows[0]?.count ?? 0);

    if (existingCount + images.length > 10) {
      throw new PropertyQueryError(
        409,
        "PROPERTY_IMAGE_LIMIT_REACHED",
        "A property can have at most 10 images",
      );
    }

    const existingPrimary = await client.query(
      `SELECT id FROM property_images
       WHERE property_id = $1 AND is_primary = TRUE`,
      [propertyId],
    );

    let needsPrimary = existingPrimary.rowCount === 0;

    const inserted: PropertyImage[] = [];

    const orderResult = await client.query<{ next_order: number }>(
      `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order
       FROM property_images WHERE property_id = $1`,
      [propertyId],
    );

    let displayOrder = orderResult.rows[0]!.next_order;

    for (const image of images) {
      const isPrimary = needsPrimary;
      needsPrimary = false;

      const result = await client.query<PropertyImage>(
        `INSERT INTO property_images (
           property_id, storage_key, original_filename, mime_type,
           file_size, is_primary, display_order
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          propertyId,
          image.storageKey,
          image.originalFilename,
          image.mimeType,
          image.fileSize,
          isPrimary,
          displayOrder++,
        ],
      );

      inserted.push(result.rows[0]!);
    }

    await writeAuditLog(client, {
      actorId: ownerId,
      action: "property.images_uploaded",
      entityType: "property",
      entityId: propertyId,
      oldValues: null,
      newValues: { image_count: inserted.length },
    });

    await client.query("COMMIT");
    return inserted;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

//propertyhistory
export async function getMyPropertyHistory(
  ownerId: string,
  propertyId: string,
) {
  const propertyResult = await pool.query(
    `SELECT id
     FROM properties
     WHERE id = $1 AND owner_id = $2`,
    [propertyId, ownerId],
  );

  if (propertyResult.rows.length === 0) {
    throw new PropertyQueryError(
      404,
      "PROPERTY_NOT_FOUND",
      "Property not found",
    );
  }

  const result = await pool.query(
    `SELECT id, actor_id, action, old_values, new_values, created_at
     FROM audit_logs
     WHERE entity_type = 'property' AND entity_id = $1
     ORDER BY created_at DESC`,
    [propertyId],
  );

  return result.rows;
}

//images for property
export async function listPropertyImages(
  ownerId: string,
  propertyId: string,
): Promise<PropertyImage[]> {
  const property = await pool.query(
    `SELECT id FROM properties WHERE id = $1 AND owner_id = $2`,
    [propertyId, ownerId],
  );

  if (property.rowCount === 0) {
    throw new PropertyQueryError(
      404,
      "PROPERTY_NOT_FOUND",
      "Property not found",
    );
  }

  const result = await pool.query<PropertyImage>(
    `SELECT * FROM property_images
     WHERE property_id = $1
     ORDER BY is_primary DESC, display_order ASC, created_at ASC`,
    [propertyId],
  );

  return result.rows;
}

export async function deletePropertyImageMetadata(
  ownerId: string,
  propertyId: string,
  imageId: string,
): Promise<PropertyImage> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const propertyResult = await client.query<{
      id: string;
      status: PropertyStatus;
    }>(
      `SELECT id, status FROM properties
       WHERE id = $1 AND owner_id = $2
       FOR UPDATE`,
      [propertyId, ownerId],
    );

    const property = propertyResult.rows[0];

    if (!property) {
      throw new PropertyQueryError(
        404,
        "PROPERTY_NOT_FOUND",
        "Property not found",
      );
    }

    if (!["draft", "pending_approval"].includes(property.status)) {
      throw new PropertyQueryError(
        409,
        "PROPERTY_IMAGES_LOCKED",
        "Images can only be changed on draft or pending-approval properties",
      );
    }

    const imageResult = await client.query<PropertyImage>(
      `SELECT * FROM property_images
       WHERE id = $1 AND property_id = $2
       FOR UPDATE`,
      [imageId, propertyId],
    );

    const image = imageResult.rows[0];

    if (!image) {
      throw new PropertyQueryError(
        404,
        "PROPERTY_IMAGE_NOT_FOUND",
        "Property image not found",
      );
    }

    await client.query(`DELETE FROM property_images WHERE id = $1`, [imageId]);

    if (image.is_primary) {
      const nextImage = await client.query<{ id: string }>(
        `SELECT id FROM property_images
         WHERE property_id = $1
         ORDER BY display_order ASC, created_at ASC
         LIMIT 1`,
        [propertyId],
      );

      if (nextImage.rows[0]) {
        await client.query(
          `UPDATE property_images SET is_primary = TRUE WHERE id = $1`,
          [nextImage.rows[0].id],
        );
      }
    }

    await writeAuditLog(client, {
      actorId: ownerId,
      action: "property.image_deleted",
      entityType: "property",
      entityId: propertyId,
      oldValues: { image_id: image.id },
      newValues: null,
    });

    await client.query("COMMIT");
    return image;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Public property queries
export async function listPublicProperties(query: PublicPropertyListQuery) {
  const values: unknown[] = [];
  const conditions: string[] = ["p.status = 'active'"];

  const add = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (query.q) {
    const param = add(`%${query.q}%`);
    conditions.push(`
      (
        p.title ILIKE ${param}
        OR p.description ILIKE ${param}
        OR c.name ILIKE ${param}
        OR l.name ILIKE ${param}
      )
    `);
  }

  if (query.location_id) {
    conditions.push(`p.location_id = ${add(query.location_id)}`);
  }

  if (query.category_ids?.length) {
    conditions.push(`p.category_id = ANY(${add(query.category_ids)}::uuid[])`);
  }

  if (query.features?.length) {
    conditions.push(`p.features @> ${add(query.features)}::text[]`);
  }

  if (query.price_min !== undefined) {
    conditions.push(`p.price >= ${add(query.price_min)}`);
  }

  if (query.price_max !== undefined) {
    conditions.push(`p.price <= ${add(query.price_max)}`);
  }

  if (query.min_size_sqm !== undefined) {
    conditions.push(`p.size_sqm >= ${add(query.min_size_sqm)}`);
  }

  if (query.min_bedrooms !== undefined) {
    conditions.push(`p.bedrooms >= ${add(query.min_bedrooms)}`);
  }

  if (query.payment_plan) {
    conditions.push(`p.payment_plan = ${add(query.payment_plan)}`);
  }

  const where = conditions.join(" AND ");
  const countValues = [...values];

  const orderBy = {
    newest: "p.created_at DESC",
    price_asc: "p.price ASC NULLS LAST, p.created_at DESC",
    price_desc: "p.price DESC NULLS LAST, p.created_at DESC",
    location: "l.name ASC, p.created_at DESC",
    relevance: query.q
      ? `CASE WHEN p.title ILIKE ${add(`${query.q}%`)} THEN 0
              WHEN l.name ILIKE ${add(`%${query.q}%`)} THEN 1
              ELSE 2 END, p.created_at DESC`
      : "p.created_at DESC",
  }[query.sort];

  const limitParam = add(query.limit);
  const offsetParam = add((query.page - 1) * query.limit);

  const result = await pool.query(
    `WITH ranked AS (
       SELECT
         p.*,
         c.name AS category_name,
         l.name AS location_name,
         ROW_NUMBER() OVER (
           PARTITION BY
             LOWER(TRIM(p.title)),
             p.category_id,
             p.location_id,
             p.price
           ORDER BY p.created_at DESC
         ) AS duplicate_rank,
         COUNT(*) OVER (
           PARTITION BY
             LOWER(TRIM(p.title)),
             p.category_id,
             p.location_id,
             p.price
         ) AS possible_duplicate_count
       FROM properties p
       JOIN property_categories c ON c.id = p.category_id
       JOIN property_locations l ON l.id = p.location_id
       WHERE ${where}
     )
     SELECT *
     FROM ranked
     WHERE duplicate_rank = 1
     ORDER BY ${orderBy}
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    values,
  );

  const count = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM (
       SELECT 1
       FROM properties p
       JOIN property_categories c ON c.id = p.category_id
       JOIN property_locations l ON l.id = p.location_id
       WHERE ${where}
       GROUP BY
         LOWER(TRIM(p.title)),
         p.category_id,
         p.location_id,
         p.price
     ) AS grouped_properties`,
    countValues,
  );

  return {
    items: result.rows.map((row) => ({
      ...row,
      possible_duplicate: Number(row.possible_duplicate_count) > 1,
      possible_duplicate_count: Number(row.possible_duplicate_count),
    })),
    page: query.page,
    limit: query.limit,
    total: Number(count.rows[0]?.count ?? 0),
  };
}
export async function getPublicProperty(propertyId: string) {
  const result = await pool.query<Property>(
    `SELECT
       p.*,
       c.name AS category_name,
       l.name AS location_name
     FROM properties p
     JOIN property_categories c ON c.id = p.category_id
     JOIN property_locations l ON l.id = p.location_id
     WHERE p.id = $1 AND p.status = 'active'`,
    [propertyId],
  );

  return result.rows[0] ?? null;
}

export async function comparePublicProperties(ids: string[]) {
  const result = await pool.query<Property>(
    `SELECT p.*, c.name AS category_name, l.name AS location_name
FROM properties p
JOIN property_categories c ON c.id = p.category_id
JOIN property_locations l ON l.id = p.location_id
WHERE p.id = ANY($1::uuid[])
  AND p.status = 'active'`,
    [ids],
  );

  // Preserve the order requested by the client.
  const byId = new Map(result.rows.map((property) => [property.id, property]));
  return ids
    .map((id) => byId.get(id))
    .filter((property): property is Property => property !== undefined);
}

export async function listRecommendedProperties(userId: string) {
  const result = await pool.query(
    `SELECT
       p.*,
       c.name AS category_name,
       l.name AS location_name,
       (
         CASE WHEN pref.budget_min IS NOT NULL
                   AND p.price >= pref.budget_min THEN 1 ELSE 0 END +
         CASE WHEN pref.budget_max IS NOT NULL
                   AND p.price <= pref.budget_max THEN 1 ELSE 0 END +
         CASE WHEN EXISTS (
                   SELECT 1
                   FROM preference_categories pc
                   WHERE pc.user_id = pref.user_id
                     AND pc.category_id = p.category_id
              )
              THEN 2 ELSE 0 END +
         CASE WHEN EXISTS (
                   SELECT 1
                   FROM preference_locations pl
                   WHERE pl.user_id = pref.user_id
                     AND pl.location_id = p.location_id
              )
              THEN 2 ELSE 0 END +
         CASE WHEN cardinality(pref.features) > 0
                   AND p.features && pref.features
              THEN 1 ELSE 0 END +
         CASE WHEN pref.min_size_sqm IS NOT NULL
                   AND p.size_sqm >= pref.min_size_sqm
              THEN 1 ELSE 0 END +
         CASE WHEN pref.min_bedrooms IS NOT NULL
                   AND p.bedrooms >= pref.min_bedrooms
              THEN 1 ELSE 0 END +
         CASE WHEN pref.payment_preference IS NOT NULL
                   AND p.payment_plan = pref.payment_preference
              THEN 1 ELSE 0 END
       ) AS match_score
     FROM properties p
     JOIN preferences pref ON pref.user_id = $1
     JOIN property_categories c ON c.id = p.category_id
     JOIN property_locations l ON l.id = p.location_id
     WHERE p.status = 'active'
       AND (
         pref.budget_min IS NULL OR p.price >= pref.budget_min
       )
       AND (
         pref.budget_max IS NULL OR p.price <= pref.budget_max
       )
       AND (
         NOT EXISTS (
           SELECT 1
           FROM preference_categories pc
           WHERE pc.user_id = pref.user_id
         )
         OR EXISTS (
           SELECT 1
           FROM preference_categories pc
           WHERE pc.user_id = pref.user_id
             AND pc.category_id = p.category_id
         )
       )
       AND (
         NOT EXISTS (
           SELECT 1
           FROM preference_locations pl
           WHERE pl.user_id = pref.user_id
         )
         OR EXISTS (
           SELECT 1
           FROM preference_locations pl
           WHERE pl.user_id = pref.user_id
             AND pl.location_id = p.location_id
         )
       )
       AND (
         cardinality(pref.features) = 0
         OR p.features && pref.features
       )
       AND (
         pref.min_size_sqm IS NULL OR p.size_sqm >= pref.min_size_sqm
       )
       AND (
         pref.min_bedrooms IS NULL OR p.bedrooms >= pref.min_bedrooms
       )
       AND (
         pref.payment_preference IS NULL
         OR p.payment_plan = pref.payment_preference
       )
     ORDER BY match_score DESC, p.created_at DESC
     LIMIT 50`,
    [userId],
  );

  return result.rows;
}

// Admin property queries
export async function getAdminPendingProperties(
  query: AdminPendingPropertyListQuery,
) {
  const offset = (query.page - 1) * query.limit;

  const result = await pool.query<Property>(
    `SELECT p.*, c.name AS category_name, l.name AS location_name
FROM properties p
JOIN property_categories c ON c.id = p.category_id
JOIN property_locations l ON l.id = p.location_id
WHERE p.status = 'pending_approval'
ORDER BY p.created_at ASC
LIMIT $1 OFFSET $2`,
    [query.limit, offset],
  );

  const count = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM properties
     WHERE status = 'pending_approval'`,
  );

  return {
    items: result.rows,
    page: query.page,
    limit: query.limit,
    total: Number(count.rows[0]?.count ?? 0),
  };
}

export async function getAdminPendingProperty(
  propertyId: string,
): Promise<Property> {
  const result = await pool.query<Property>(
    `SELECT p.*, c.name AS category_name, l.name AS location_name
FROM properties p
JOIN property_categories c ON c.id = p.category_id
JOIN property_locations l ON l.id = p.location_id
WHERE p.id = $1 AND p.status = 'pending_approval'
ORDER BY p.created_at ASC
LIMIT $1 OFFSET $2`,
    [propertyId],
  );

  if (!result.rows[0]) {
    throw new PropertyQueryError(
      404,
      "PENDING_PROPERTY_NOT_FOUND",
      "Pending property not found",
    );
  }

  return result.rows[0];
}

export async function decideAdminProperty(
  propertyId: string,
  adminId: string,
  input: AdminPropertyDecisionInput,
): Promise<Property> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query<Property>(
      `SELECT *
       FROM properties
       WHERE id = $1
       FOR UPDATE`,
      [propertyId],
    );

    const current = result.rows[0];

    if (!current) {
      throw new PropertyQueryError(
        404,
        "PROPERTY_NOT_FOUND",
        "Property not found",
      );
    }

    if (current.status !== "pending_approval") {
      throw new PropertyQueryError(
        409,
        "PROPERTY_NOT_PENDING",
        "Only pending properties can be approved or rejected",
      );
    }

    const status = input.decision === "approve" ? "active" : "rejected";
    const rejectionReason =
      input.decision === "reject" ? input.rejection_reason! : null;

    await client.query(
      `UPDATE properties
       SET status = $1::property_status,
           rejection_reason = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [status, rejectionReason, propertyId],
    );

    const updatedResult = await client.query<Property>(
      `SELECT p.*, c.name AS category_name, l.name AS location_name
       FROM properties p
       JOIN property_categories c ON c.id = p.category_id
       JOIN property_locations l ON l.id = p.location_id
       WHERE p.id = $1`,
      [propertyId],
    );

    const updated = updatedResult.rows[0]!;

    await writeAuditLog(client, {
      actorId: adminId,
      action:
        input.decision === "approve"
          ? "property.approved"
          : "property.rejected",
      entityType: "property",
      entityId: propertyId,
      oldValues: {
        status: current.status,
        rejection_reason: current.rejection_reason,
      },
      newValues: {
        status: updated.status,
        rejection_reason: updated.rejection_reason,
      },
    });

    await client.query("COMMIT");
    return updated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function listDeveloperProjectProperties(
  projectId: string,
  developerId: string,
  query: { page: number; limit: number },
) {
  // Verify project ownership.
  const projectResult = await pool.query(
    `SELECT id
     FROM projects
     WHERE id = $1 AND developer_id = $2`,
    [projectId, developerId],
  );

  if (projectResult.rows.length === 0) {
    return null;
  }

  const offset = (query.page - 1) * query.limit;

  // Return all properties, regardless of status.
  const result = await pool.query<Property>(
    `SELECT p.*, c.name AS category_name, l.name AS location_name
FROM properties p
JOIN property_categories c ON c.id = p.category_id
JOIN property_locations l ON l.id = p.location_id
WHERE p.project_id = $1
ORDER BY p.created_at DESC, p.id DESC
LIMIT $2 OFFSET $3`,
    [projectId, query.limit, offset],
  );

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM properties
     WHERE project_id = $1`,
    [projectId],
  );

  const total = Number(countResult.rows[0]?.count ?? 0);

  return {
    items: result.rows,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  };
}

// Update property pricing for a property owner.
export async function updateMyPropertyPricing(
  ownerId: string,
  propertyId: string,
  input: { price: number },
): Promise<{ property: Property; previousPrice: string | null }> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await getClientProperty(client, propertyId, ownerId, true);

    if (current.status !== "active") {
      throw new PropertyQueryError(
        409,
        "PROPERTY_NOT_ACTIVE",
        "Only active properties can have their pricing updated",
      );
    }

    const previousPrice = current.price;

    // Avoid unnecessary updates and audit records when the price is unchanged.
    if (previousPrice !== null && Number(previousPrice) === input.price) {
      await client.query("COMMIT");
      return { property: current, previousPrice };
    }

    const result = await client.query<Property>(
      `UPDATE properties
       SET price = $1, updated_at = NOW()
       WHERE id = $2 AND owner_id = $3
       RETURNING *`,
      [input.price, propertyId, ownerId],
    );

    const updated = result.rows[0]!;

    await writeAuditLog(client, {
      actorId: ownerId,
      action: "property.pricing_updated",
      entityType: "property",
      entityId: propertyId,
      oldValues: { price: previousPrice },
      newValues: { price: updated.price },
    });

    await client.query("COMMIT");

    return { property: updated, previousPrice };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
