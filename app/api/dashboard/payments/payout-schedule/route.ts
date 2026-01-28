/**
 * Payout Schedule API
 * GET: Fetch current payout schedule
 * PUT: Update payout schedule
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import {
  getConnectAccountForBusiness,
  getPayoutSchedule,
  updatePayoutSchedule,
} from "@/lib/stripe/connect";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/payments/payout-schedule
 * Fetch current payout schedule for the business
 */
async function handleGet(
  _request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    // Get Connect account
    const connectAccount = await getConnectAccountForBusiness(business.id);
    if (!connectAccount || !connectAccount.isActive) {
      return errors.badRequest("Stripe Connect not configured");
    }

    const schedule = await getPayoutSchedule(connectAccount.accountId);

    return success({
      interval: schedule.interval,
      weeklyAnchor: schedule.weeklyAnchor,
      monthlyAnchor: schedule.monthlyAnchor,
      delayDays: schedule.delayDays,
    });
  } catch (error) {
    logError("Payout Schedule - GET", error);
    return errors.internalError("Failed to fetch payout schedule");
  }
}

/**
 * PUT /api/dashboard/payments/payout-schedule
 * Update payout schedule for the business
 */
async function handlePut(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    // Get Connect account
    const connectAccount = await getConnectAccountForBusiness(business.id);
    if (!connectAccount || !connectAccount.isActive) {
      return errors.badRequest("Stripe Connect not configured");
    }

    // Parse and validate request body
    const body = await request.json();

    // Validate interval
    const validIntervals = ["manual", "daily", "weekly", "monthly"];
    if (body.interval && !validIntervals.includes(body.interval)) {
      return errors.badRequest("interval must be one of: manual, daily, weekly, monthly");
    }

    // Validate weekly anchor
    const validWeeklyAnchors = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    if (body.weeklyAnchor && !validWeeklyAnchors.includes(body.weeklyAnchor)) {
      return errors.badRequest("weeklyAnchor must be a valid day of the week");
    }

    // Validate monthly anchor
    if (
      body.monthlyAnchor !== undefined &&
      (typeof body.monthlyAnchor !== "number" ||
        body.monthlyAnchor < 1 ||
        body.monthlyAnchor > 31)
    ) {
      return errors.badRequest("monthlyAnchor must be a number between 1 and 31");
    }

    // Validate delay days
    if (
      body.delayDays !== undefined &&
      (typeof body.delayDays !== "number" ||
        body.delayDays < 2 ||
        body.delayDays > 14)
    ) {
      return errors.badRequest("delayDays must be a number between 2 and 14");
    }

    // Build update object
    const scheduleUpdate: {
      interval?: "manual" | "daily" | "weekly" | "monthly";
      weeklyAnchor?: string;
      monthlyAnchor?: number;
      delayDays?: number;
    } = {};

    if (body.interval) scheduleUpdate.interval = body.interval;
    if (body.weeklyAnchor) scheduleUpdate.weeklyAnchor = body.weeklyAnchor;
    if (body.monthlyAnchor !== undefined)
      scheduleUpdate.monthlyAnchor = body.monthlyAnchor;
    if (body.delayDays !== undefined) scheduleUpdate.delayDays = body.delayDays;

    // Update payout schedule via Stripe
    const updatedSchedule = await updatePayoutSchedule(
      connectAccount.accountId,
      scheduleUpdate
    );

    return success({
      interval: updatedSchedule.interval,
      weeklyAnchor: updatedSchedule.weeklyAnchor,
      monthlyAnchor: updatedSchedule.monthlyAnchor,
      delayDays: updatedSchedule.delayDays,
    });
  } catch (error) {
    logError("Payout Schedule - PUT", error);
    return errors.internalError("Failed to update payout schedule");
  }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
