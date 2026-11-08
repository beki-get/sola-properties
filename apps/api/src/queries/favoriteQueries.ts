import { pool } from "../config/database.js";

export class FavoriteError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "FavoriteError";
  }
}

// Add a property to favorites.
export async function addFavorite(buyerId: string, propertyId: string) {
  try {
    const result = await pool.query(
      `INSERT INTO favorites (buyer_id, property_id)
       SELECT $1, id
       FROM properties
       WHERE id = $2 AND status = 'active'
       RETURNING id, property_id, created_at`,
      [buyerId, propertyId],
    );

    if (result.rowCount === 0) {
      const property = await pool.query(
        `SELECT status FROM properties WHERE id = $1`,
        [propertyId],
      );

      if (property.rowCount === 0) {
        throw new FavoriteError(
          404,
          "PROPERTY_NOT_FOUND",
          "Property not found",
        );
      }

      throw new FavoriteError(
        409,
        "PROPERTY_NOT_ACTIVE",
        "Only active properties can be favorited",
      );
    }

    return result.rows[0];
  } catch (error) {
    if (
      error instanceof FavoriteError
    ) {
      throw error;
    }

    const pgError = error as {
      code?: string;
      constraint?: string;
    };

    if (
      pgError.code === "23505" &&
      pgError.constraint === "favorites_buyer_property_unique"
    ) {
      throw new FavoriteError(
        409,
        "PROPERTY_ALREADY_FAVORITED",
        "You have already favorited this property",
      );
    }

    throw error;
  }
}

// Retrieve a buyer's favorites with property details and images.
export async function getBuyerFavorites(
  buyerId: string,
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM favorites
     WHERE buyer_id = $1`,
    [buyerId],
  );

  const result = await pool.query(
    `SELECT
       f.id AS favorite_id,
       f.created_at AS favorited_at,
       p.id AS property_id,
       p.title,
       p.description,
       p.property_type,
       p.location,
       p.size_sqm,
       p.bedrooms,
       p.bathrooms,
       p.features,
       p.price,
       p.payment_plan,
       p.status AS property_status,
       p.created_at AS property_created_at,

       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'id', pi.id,
               'storage_key', pi.storage_key,
               'original_filename', pi.original_filename,
               'mime_type', pi.mime_type,
               'file_size', pi.file_size,
               'is_primary', pi.is_primary,
               'display_order', pi.display_order
             )
             ORDER BY
               pi.is_primary DESC,
               pi.display_order ASC,
               pi.created_at ASC
           )
           FROM property_images pi
           WHERE pi.property_id = p.id
         ),
         '[]'::json
       ) AS images

     FROM favorites f
     JOIN properties p ON p.id = f.property_id
     WHERE f.buyer_id = $1
     ORDER BY f.created_at DESC
     LIMIT $2 OFFSET $3`,
    [buyerId, limit, offset],
  );

  const total = countResult.rows[0].total;

  return {
    favorites: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Remove a buyer's own favorite.
export async function removeFavorite(
  buyerId: string,
  propertyId: string,
) {
  const result = await pool.query(
    `DELETE FROM favorites
     WHERE buyer_id = $1 AND property_id = $2
     RETURNING id`,
    [buyerId, propertyId],
  );

  if (result.rowCount === 0) {
    throw new FavoriteError(
      404,
      "FAVORITE_NOT_FOUND",
      "Favorite not found",
    );
  }

  return result.rows[0];
}

// Get a list of buyer IDs who have favorited a specific property.
export async function getPropertyFavoriteBuyerIds(propertyId: string) {
  const result = await pool.query<{ buyer_id: string }>(
    `SELECT DISTINCT buyer_id
     FROM favorites
     WHERE property_id = $1`,
    [propertyId],
  );

  return result.rows.map((row) => row.buyer_id);
}