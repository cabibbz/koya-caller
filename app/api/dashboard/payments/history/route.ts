/**
 * Payment History API
 * GET: Fetch payment transaction history for the business
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { getPaymentTransactions } from "@/lib/stripe/connect";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/payments/history
 * Fetch payment transaction history with pagination
 */
async function handleGet(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const status = searchParams.get("status") as "pending" | "succeeded" | "failed" | "refunded" | "partially_refunded" | null;
    const paymentType = searchParams.get("paymentType") as "deposit" | "balance" | "full" | null;

    // Validate limit
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safeOffset = Math.max(0, offset);

    // Get payment transactions
    const transactions = await getPaymentTransactions(business.id, {
      limit: safeLimit,
      offset: safeOffset,
      status: status || undefined,
      paymentType: paymentType || undefined,
    });

    // Get total count for pagination
    const { count } = await supabase
      .from("payment_transactions")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id);

    return success({
      transactions: transactions.map((tx) => ({
        id: tx.id,
        appointmentId: tx.appointmentId,
        amountCents: tx.amountCents,
        feeCents: tx.feeCents,
        netAmountCents: tx.netAmountCents,
        currency: tx.currency,
        status: tx.status,
        paymentType: tx.paymentType,
        customerEmail: tx.customerEmail,
        customerPhone: tx.customerPhone,
        description: tx.description,
        createdAt: tx.createdAt.toISOString(),
      })),
      pagination: {
        total: count || 0,
        limit: safeLimit,
        offset: safeOffset,
        hasMore: (count || 0) > safeOffset + safeLimit,
      },
    });
  } catch (error) {
    logError("Payment History - GET", error);
    return errors.internalError("Failed to fetch payment history");
  }
}

export const GET = withAuth(handleGet);
