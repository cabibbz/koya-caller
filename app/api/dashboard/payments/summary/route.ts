/**
 * Payment Summary API
 * GET: Fetch revenue summary for the business
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { getPaymentSummary, getConnectAccountForBusiness, getAccountStatus } from "@/lib/stripe/connect";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/payments/summary
 * Fetch revenue summary for different time periods
 */
async function handleGet(
  _request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    // Check if Stripe Connect is configured
    const connectAccount = await getConnectAccountForBusiness(business.id);
    if (!connectAccount) {
      return success({
        connected: false,
        today: null,
        thisWeek: null,
        thisMonth: null,
        allTime: null,
      });
    }

    // Get account status
    let accountStatus = null;
    try {
      accountStatus = await getAccountStatus(connectAccount.accountId);
    } catch (error) {
      logError("Payment Summary - Account Status", error);
    }

    // Calculate date ranges
    const now = new Date();

    // Today
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // This week (starts on Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // This month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // All time - use a date far in the past
    const allTimeStart = new Date(2020, 0, 1);

    // Fetch summaries for each period in parallel
    const [todaySummary, weekSummary, monthSummary, allTimeSummary] = await Promise.all([
      getPaymentSummary(business.id, { start: startOfToday, end: now }),
      getPaymentSummary(business.id, { start: startOfWeek, end: now }),
      getPaymentSummary(business.id, { start: startOfMonth, end: now }),
      getPaymentSummary(business.id, { start: allTimeStart, end: now }),
    ]);

    // Calculate platform fee rate (from the backend constants)
    const platformFeeRate = 0.029; // 2.9%
    const minimumFeeCents = 30;

    return success({
      connected: true,
      accountId: connectAccount.accountId,
      isActive: connectAccount.isActive,
      chargesEnabled: accountStatus?.chargesEnabled || false,
      payoutsEnabled: accountStatus?.payoutsEnabled || false,
      today: {
        grossRevenue: todaySummary.totalRevenue,
        platformFees: todaySummary.totalFees,
        netRevenue: todaySummary.netRevenue,
        transactionCount: todaySummary.transactionCount,
        averageTransaction: todaySummary.averageTransaction,
      },
      thisWeek: {
        grossRevenue: weekSummary.totalRevenue,
        platformFees: weekSummary.totalFees,
        netRevenue: weekSummary.netRevenue,
        transactionCount: weekSummary.transactionCount,
        averageTransaction: weekSummary.averageTransaction,
      },
      thisMonth: {
        grossRevenue: monthSummary.totalRevenue,
        platformFees: monthSummary.totalFees,
        netRevenue: monthSummary.netRevenue,
        transactionCount: monthSummary.transactionCount,
        averageTransaction: monthSummary.averageTransaction,
        depositCount: monthSummary.depositCount,
        balanceCount: monthSummary.balanceCount,
      },
      allTime: {
        grossRevenue: allTimeSummary.totalRevenue,
        platformFees: allTimeSummary.totalFees,
        netRevenue: allTimeSummary.netRevenue,
        transactionCount: allTimeSummary.transactionCount,
        averageTransaction: allTimeSummary.averageTransaction,
      },
      fees: {
        platformFeeRate,
        minimumFeeCents,
        stripeFeeRate: 0.029, // Standard Stripe rate
        stripeFeeFixed: 30, // $0.30 per transaction
      },
    });
  } catch (error) {
    logError("Payment Summary - GET", error);
    return errors.internalError("Failed to fetch payment summary");
  }
}

export const GET = withAuth(handleGet);
