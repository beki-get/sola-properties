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

export const createBuyerVisitRequestService = (
  buyerId: string,
  referralId: string,
  data: CreateVisitRequestInput,
) => createBuyerVisitRequest(buyerId, referralId, data);

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

export const schedulePropertyVisitService = (
  visitId: string,
  sellerId: string,
  data: ScheduleVisitInput,
) => schedulePropertyVisit(visitId, sellerId, data);

export const updatePropertyVisitService = (
  visitId: string,
  sellerId: string,
  data: UpdateVisitInput,
) => updatePropertyVisit(visitId, sellerId, data);

export const cancelPropertyVisitService = (
  visitId: string,
  userId: string,
) => cancelPropertyVisit(visitId, userId);

export const recordPropertyVisitOutcomeService = (
  visitId: string,
  sellerId: string,
  data: VisitOutcomeInput,
) => recordPropertyVisitOutcome(visitId, sellerId, data);