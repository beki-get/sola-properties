import {
  createBuyerVisitRequest,
  getBuyerVisits,
  getSellerVisits,
  schedulePropertyVisit,
  updatePropertyVisit,
  cancelPropertyVisit,
  recordPropertyVisitOutcome,
} from "../queries/referralOperationsQueries.js";

import type {
  CreateVisitRequestInput,
  ScheduleVisitInput,
  UpdateVisitInput,
  VisitOutcomeInput,
} from "../schemas/referralOperationsSchemas.js";

import { notifyUser } from "./notificationService.js";
import { logger } from "../utils/logger.js";

async function sendVisitNotification(input: {
  recipientId: string | null;
  type: string;
  title: string;
  message: string;
  entityId: string;
}) {
  if (!input.recipientId) return;

  try {
    await notifyUser({
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      message: input.message,
      entityType: "property_visit",
      entityId: input.entityId,
    });
  } catch (error) {
    logger.error(
      { err: error, visitId: input.entityId },
      "Failed to create property visit notification",
    );
  }
}

export async function createBuyerVisitRequestService(
  buyerId: string,
  referralId: string,
  data: CreateVisitRequestInput,
) {
  const { recipient_id, ...visit } = await createBuyerVisitRequest(
    buyerId,
    referralId,
    data,
  );

  await sendVisitNotification({
    recipientId: recipient_id,
    type: "property_visit_requested",
    title: "New property visit request",
    message: "A buyer has requested a property visit.",
    entityId: visit.id,
  });

  return visit;
}

export const getBuyerVisitsService = (
  buyerId: string,
  page: number,
  limit: number,
) => getBuyerVisits(buyerId, page, limit);

export const getSellerVisitsService = (
  referralId: string,
  sellerId: string,
  page: number,
  limit: number,
) => getSellerVisits(referralId, sellerId, page, limit);

export async function schedulePropertyVisitService(
  visitId: string,
  sellerId: string,
  data: ScheduleVisitInput,
) {
  const { recipient_id, ...visit } = await schedulePropertyVisit(
    visitId,
    sellerId,
    data,
  );

  await sendVisitNotification({
    recipientId: recipient_id,
    type: "property_visit_scheduled",
    title: "Property visit scheduled",
    message: "Your property visit has been scheduled.",
    entityId: visit.id,
  });

  return visit;
}

export async function updatePropertyVisitService(
  visitId: string,
  sellerId: string,
  data: UpdateVisitInput,
) {
  const { recipient_id, ...visit } = await updatePropertyVisit(
    visitId,
    sellerId,
    data,
  );

  await sendVisitNotification({
    recipientId: recipient_id,
    type: "property_visit_updated",
    title: "Property visit updated",
    message: "The details of your property visit have been updated.",
    entityId: visit.id,
  });

  return visit;
}

export async function cancelPropertyVisitService(
  visitId: string,
  userId: string,
) {
  const { recipient_id, ...visit } = await cancelPropertyVisit(visitId, userId);

  // Do not notify the buyer if they cancelled their own visit.
  if (recipient_id !== userId) {
    await sendVisitNotification({
      recipientId: recipient_id,
      type: "property_visit_cancelled",
      title: "Property visit cancelled",
      message: "Your property visit has been cancelled.",
      entityId: visit.id,
    });
  }

  return visit;
}
export const recordPropertyVisitOutcomeService = (
  visitId: string,
  sellerId: string,
  data: VisitOutcomeInput,
) => recordPropertyVisitOutcome(visitId, sellerId, data);
