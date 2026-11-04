import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { FavoriteError } from "../../src/queries/favoriteQueries";

const authState = vi.hoisted(() => ({
  currentUser: {
    id: "buyer-123",
    fullName: "Buyer Test User",
    email: "buyer@example.com",
    role: "buyer" as const,
    status: "approved" as const,
    emailVerified: true,
  },
}));

const mocks = vi.hoisted(() => ({
  addFavoriteService: vi.fn(),
  getBuyerFavoritesService: vi.fn(),
  removeFavoriteService: vi.fn(),
}));

vi.mock("../../src/services/favoriteService", () => ({
  addFavoriteService: mocks.addFavoriteService,
  getBuyerFavoritesService: mocks.getBuyerFavoritesService,
  removeFavoriteService: mocks.removeFavoriteService,
}));

vi.mock("../../src/middlewares/authenticate", () => ({
  authenticate: (req: any, res: any, next: () => void) => {
    if (!authState.currentUser) {
      res.status(401).json({
        message: "Unauthorized",
        code: "UNAUTHENTICATED",
      });
      return;
    }

    req.currentUser = authState.currentUser;
    next();
  },
}));

vi.mock("../../src/middlewares/requireApprovedAccount", () => ({
  requireApprovedAccount: (_req: any, _res: any, next: () => void) => {
    next();
  },
}));

vi.mock("../../src/middlewares/authorizeRoles", () => ({
  authorizeRoles: (...allowedRoles: string[]) => {
    return (req: any, res: any, next: () => void) => {
      if (!req.currentUser || !allowedRoles.includes(req.currentUser.role)) {
        res.status(403).json({
          message: "You do not have permission to access this resource",
          code: "ROLE_NOT_ALLOWED",
        });
        return;
      }

      next();
    };
  },
}));

import favoriteRoutes from "../../src/routes/favoriteRoutes";

const app = express();
app.use(express.json());
app.use("/api/v1/favorites", favoriteRoutes);

beforeEach(() => {
  vi.clearAllMocks();
  authState.currentUser = {
    id: "buyer-123",
    fullName: "Buyer Test User",
    email: "buyer@example.com",
    role: "buyer",
    status: "approved",
    emailVerified: true,
  };
});

describe("Favorite routes", () => {
  it("adds a property to favorites", async () => {
    const favorite = {
      id: "fav-1",
      property_id: "11111111-1111-4111-8111-111111111111",
      created_at: new Date().toISOString(),
    };

    mocks.addFavoriteService.mockResolvedValueOnce(favorite as never);

    const response = await request(app).post("/api/v1/favorites").send({
      propertyId: "11111111-1111-4111-8111-111111111111",
    });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe(
      "Property added to favorites successfully",
    );
    expect(mocks.addFavoriteService).toHaveBeenCalledWith(
      "buyer-123",
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("returns 409 when a buyer tries to favorite the same property twice", async () => {
    mocks.addFavoriteService.mockRejectedValueOnce(
      new FavoriteError(
        409,
        "PROPERTY_ALREADY_FAVORITED",
        "You have already favorited this property",
      ),
    );

    const response = await request(app).post("/api/v1/favorites").send({
      propertyId: "11111111-1111-4111-8111-111111111111",
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("PROPERTY_ALREADY_FAVORITED");
  });

  it("returns 404 when a buyer favorites a nonexistent property", async () => {
    mocks.addFavoriteService.mockRejectedValueOnce(
      new FavoriteError(404, "PROPERTY_NOT_FOUND", "Property not found"),
    );

    const response = await request(app).post("/api/v1/favorites").send({
      propertyId: "22222222-2222-4222-8222-222222222222",
    });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("PROPERTY_NOT_FOUND");
  });

  it("returns 409 when a buyer favorites an inactive property", async () => {
    mocks.addFavoriteService.mockRejectedValueOnce(
      new FavoriteError(
        409,
        "PROPERTY_NOT_ACTIVE",
        "Only active properties can be favorited",
      ),
    );

    const response = await request(app).post("/api/v1/favorites").send({
      propertyId: "33333333-3333-4333-8333-333333333333",
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("PROPERTY_NOT_ACTIVE");
  });

  it("rejects invalid favorite payloads", async () => {
    const response = await request(app).post("/api/v1/favorites").send({
      propertyId: "not-a-uuid",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid request data");
  });

  it("lists the buyer's favorites with property details and images", async () => {
    const result = {
      favorites: [
        {
          favorite_id: "fav-1",
          property_id: "11111111-1111-4111-8111-111111111111",
          title: "Modern Villa",
          description: "Bright and spacious villa",
          property_type: "villa",
          status: "active",
          images: [
            {
              id: "img-1",
              storage_key: "uploads/villa-1.jpg",
              is_primary: true,
            },
          ],
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    };

    mocks.getBuyerFavoritesService.mockResolvedValueOnce(result as never);

    const response = await request(app)
      .get("/api/v1/favorites")
      .query({ page: 1, limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body.favorites).toHaveLength(1);
    expect(response.body.favorites[0].images[0].storage_key).toBe(
      "uploads/villa-1.jpg",
    );
    expect(mocks.getBuyerFavoritesService).toHaveBeenCalledWith(
      "buyer-123",
      1,
      10,
    );
  });

  it("lists favorites with correct pagination metadata", async () => {
    const result = {
      favorites: [
        {
          favorite_id: "fav-1",
          property_id: "11111111-1111-4111-8111-111111111111",
          title: "Modern Villa",
        },
        {
          favorite_id: "fav-2",
          property_id: "11111111-1111-4111-8111-111111111112",
          title: "City Apartment",
        },
      ],
      pagination: {
        page: 2,
        limit: 2,
        total: 5,
        totalPages: 3,
      },
    };

    mocks.getBuyerFavoritesService.mockResolvedValueOnce(result as never);

    const response = await request(app)
      .get("/api/v1/favorites")
      .query({ page: 2, limit: 2 });

    expect(response.status).toBe(200);
    expect(response.body.pagination.page).toBe(2);
    expect(response.body.pagination.total).toBe(5);
    expect(response.body.pagination.totalPages).toBe(3);
  });

  it("removes a favorite by property id", async () => {
    mocks.removeFavoriteService.mockResolvedValueOnce({ id: "fav-1" } as never);

    const response = await request(app).delete(
      "/api/v1/favorites/11111111-1111-4111-8111-111111111111",
    );

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Favorite removed successfully");
    expect(mocks.removeFavoriteService).toHaveBeenCalledWith(
      "buyer-123",
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("returns 404 when the buyer removes the same favorite again", async () => {
    mocks.removeFavoriteService.mockRejectedValueOnce(
      new FavoriteError(404, "FAVORITE_NOT_FOUND", "Favorite not found"),
    );

    const response = await request(app).delete(
      "/api/v1/favorites/11111111-1111-4111-8111-111111111111",
    );

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("FAVORITE_NOT_FOUND");
  });

  it("rejects invalid property ids for removal", async () => {
    const response = await request(app).delete("/api/v1/favorites/not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_PROPERTY_ID");
  });

  it("blocks a buyer from accessing another buyer's favorites", async () => {
    const result = {
      favorites: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
    };

    mocks.getBuyerFavoritesService.mockResolvedValueOnce(result as never);

    const response = await request(app)
      .get("/api/v1/favorites")
      .query({ page: 1, limit: 10 });

    expect(response.status).toBe(200);
    expect(mocks.getBuyerFavoritesService).toHaveBeenCalledWith(
      "buyer-123",
      1,
      10,
    );
    expect(mocks.getBuyerFavoritesService).not.toHaveBeenCalledWith(
      "another-buyer-id",
      1,
      10,
    );
  });

  it("forbids agent, developer, and admin access to favorites", async () => {
    for (const role of ["agent", "developer", "admin"]) {
      authState.currentUser = {
        ...authState.currentUser,
        role,
      } as any;

      const response = await request(app).get("/api/v1/favorites");

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("ROLE_NOT_ALLOWED");
    }
  });

  it("rejects unauthenticated requests to favorites", async () => {
    authState.currentUser = undefined as any;

    const response = await request(app).get("/api/v1/favorites");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHENTICATED");
  });

  it("keeps a sold property favorited but visible with updated status", async () => {
    const result = {
      favorites: [
        {
          favorite_id: "fav-1",
          property_id: "11111111-1111-4111-8111-111111111111",
          title: "Modern Villa",
          property_status: "sold",
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    };

    mocks.getBuyerFavoritesService.mockResolvedValueOnce(result as never);

    const response = await request(app)
      .get("/api/v1/favorites")
      .query({ page: 1, limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body.favorites[0].property_status).toBe("sold");
  });
});
