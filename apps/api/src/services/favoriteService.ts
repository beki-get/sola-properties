import {
  addFavorite,
  getBuyerFavorites,
  removeFavorite,
} from "../queries/favoriteQueries.js";

export async function addFavoriteService(
  buyerId: string,
  propertyId: string,
) {
  return addFavorite(buyerId, propertyId);
}

export async function getBuyerFavoritesService(
  buyerId: string,
  page: number,
  limit: number,
) {
  return getBuyerFavorites(buyerId, page, limit);
}

export async function removeFavoriteService(
  buyerId: string,
  propertyId: string,
) {
  return removeFavorite(buyerId, propertyId);
}