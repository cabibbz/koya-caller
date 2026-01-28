/**
 * Integration Manager
 * Unified interface for executing integration actions during calls
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logging";

// =============================================================================
// Types
// =============================================================================

export type IntegrationProvider =
  | "shopify"
  | "square"
  | "stripe_connect"
  | "hubspot"
  | "salesforce"
  | "opentable"
  | "mindbody";

export type IntegrationCategory = "ecommerce" | "crm" | "payments" | "industry";

export interface Integration {
  id: string;
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken?: string;
  shopDomain?: string;
  locationId?: string;
  accountId?: string;
  metadata: Record<string, unknown>;
}

export interface InventoryResult {
  available: boolean;
  quantity?: number;
  productName: string;
  price?: number;
  variants?: Array<{ name: string; available: boolean }>;
  message: string;
}

export interface OrderResult {
  found: boolean;
  orderNumber?: string;
  status?: string;
  items?: Array<{ name: string; quantity: number }>;
  trackingNumber?: string;
  estimatedDelivery?: string;
  message: string;
}

export interface LeadResult {
  success: boolean;
  leadId?: string;
  message: string;
}

export interface ReservationResult {
  available: boolean;
  times?: Array<{ time: string; partySize: number }>;
  message: string;
}

export interface PaymentResult {
  success: boolean;
  paymentLink?: string;
  message: string;
}

// =============================================================================
// Integration Fetching
// =============================================================================

/**
 * Get an active integration for a business by provider
 */
export async function getIntegration(
  businessId: string,
  provider: IntegrationProvider
): Promise<Integration | null> {
  const supabase = createAdminClient();

  // Type assertion needed since business_integrations is a new table
  const { data, error } = await (supabase as any)
    .from("business_integrations")
    .select("*")
    .eq("business_id", businessId)
    .eq("provider", provider)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return null;
  }

  const row = data as {
    id: string;
    provider: string;
    access_token: string;
    refresh_token?: string;
    shop_domain?: string;
    location_id?: string;
    account_id?: string;
    metadata?: Record<string, unknown>;
  };

  return {
    id: row.id,
    provider: row.provider as IntegrationProvider,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    shopDomain: row.shop_domain,
    locationId: row.location_id,
    accountId: row.account_id,
    metadata: row.metadata || {},
  };
}

/**
 * Get the first active integration for a business by category
 */
export async function getIntegrationByCategory(
  businessId: string,
  category: IntegrationCategory
): Promise<Integration | null> {
  const providers: Record<IntegrationCategory, IntegrationProvider[]> = {
    ecommerce: ["shopify", "square"],
    payments: ["stripe_connect"],
    crm: ["hubspot", "salesforce"],
    industry: ["opentable", "mindbody"],
  };

  const supabase = createAdminClient();

  // Type assertion needed since business_integrations is a new table
  const { data, error } = await (supabase as any)
    .from("business_integrations")
    .select("*")
    .eq("business_id", businessId)
    .in("provider", providers[category])
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  const row = data as {
    id: string;
    provider: string;
    access_token: string;
    refresh_token?: string;
    shop_domain?: string;
    location_id?: string;
    account_id?: string;
    metadata?: Record<string, unknown>;
  };

  return {
    id: row.id,
    provider: row.provider as IntegrationProvider,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    shopDomain: row.shop_domain,
    locationId: row.location_id,
    accountId: row.account_id,
    metadata: row.metadata || {},
  };
}

// =============================================================================
// E-Commerce Functions
// =============================================================================

/**
 * Check inventory for a product
 */
export async function checkInventory(
  businessId: string,
  productName: string,
  quantity: number = 1
): Promise<InventoryResult> {
  const integration = await getIntegrationByCategory(businessId, "ecommerce");

  if (!integration) {
    return {
      available: false,
      productName,
      message:
        "I don't have access to inventory information right now. Would you like me to take a message and have someone call you back?",
    };
  }

  try {
    switch (integration.provider) {
      case "shopify":
        return await checkShopifyInventory(integration, productName, quantity);
      case "square":
        return await checkSquareInventory(integration, productName, quantity);
      default:
        throw new Error(`Unknown provider: ${integration.provider}`);
    }
  } catch (error) {
    logError("Inventory Check", error);
    return {
      available: false,
      productName,
      message:
        "I'm having trouble checking inventory right now. Would you like me to take a message and have someone get back to you?",
    };
  }
}

/**
 * Check order status
 */
export async function checkOrderStatus(
  businessId: string,
  orderNumber?: string,
  customerPhone?: string
): Promise<OrderResult> {
  const integration = await getIntegrationByCategory(businessId, "ecommerce");

  if (!integration) {
    return {
      found: false,
      message:
        "I don't have access to order information right now. Would you like me to take a message and have someone call you back?",
    };
  }

  try {
    switch (integration.provider) {
      case "shopify":
        return await getShopifyOrderStatus(integration, orderNumber, customerPhone);
      case "square":
        return await getSquareOrderStatus(integration, orderNumber, customerPhone);
      default:
        throw new Error(`Unknown provider: ${integration.provider}`);
    }
  } catch (error) {
    logError("Order Status", error);
    return {
      found: false,
      message:
        "I'm having trouble looking up that order right now. Would you like me to take a message and have someone call you back?",
    };
  }
}

// =============================================================================
// CRM Functions
// =============================================================================

/**
 * Create a lead in the connected CRM
 */
export async function createLead(
  businessId: string,
  leadData: {
    name: string;
    email?: string;
    phone: string;
    interest?: string;
    notes?: string;
  }
): Promise<LeadResult> {
  const integration = await getIntegrationByCategory(businessId, "crm");

  if (!integration) {
    // No CRM connected - still return success as we don't want to break the call
    return {
      success: true,
      message: "I've noted your information and someone will follow up with you.",
    };
  }

  try {
    switch (integration.provider) {
      case "hubspot":
        return await createHubSpotContact(integration, leadData);
      case "salesforce":
        return await createSalesforceLead(integration, leadData);
      default:
        throw new Error(`Unknown provider: ${integration.provider}`);
    }
  } catch (error) {
    logError("Create Lead", error);
    return {
      success: true, // Still say success to caller
      message: "I've noted your information and someone will follow up with you.",
    };
  }
}

// =============================================================================
// Payment Functions
// =============================================================================

/**
 * Create a payment link and send via SMS
 */
export async function processPayment(
  businessId: string,
  amount: number,
  description: string,
  customerPhone: string,
  sendReceipt: boolean = true
): Promise<PaymentResult> {
  const integration = await getIntegration(businessId, "stripe_connect");

  if (!integration) {
    return {
      success: false,
      message:
        "I'm not able to process payments over the phone right now. Would you like me to take your information and have someone call you back?",
    };
  }

  try {
    return await createStripePaymentLink(
      integration,
      amount,
      description,
      customerPhone,
      sendReceipt
    );
  } catch (error) {
    logError("Payment Processing", error);
    return {
      success: false,
      message:
        "I'm having trouble processing payments right now. Would you like me to take your information and have someone call you back?",
    };
  }
}

// =============================================================================
// Industry-Specific Functions
// =============================================================================

/**
 * Check reservation availability
 */
export async function checkReservationAvailability(
  businessId: string,
  date: string,
  partySize: number,
  time?: string
): Promise<ReservationResult> {
  const integration = await getIntegrationByCategory(businessId, "industry");

  if (!integration) {
    return {
      available: false,
      message:
        "I don't have access to the reservation system right now. Would you like me to take a message and have someone call you back?",
    };
  }

  try {
    switch (integration.provider) {
      case "opentable":
        return await checkOpenTableAvailability(integration, date, partySize, time);
      case "mindbody":
        return await checkMindbodyAvailability(integration, date, partySize, time);
      default:
        throw new Error(`Unknown provider: ${integration.provider}`);
    }
  } catch (error) {
    logError("Reservation Check", error);
    return {
      available: false,
      message:
        "I'm having trouble checking availability right now. Would you like me to take a message and have someone call you back?",
    };
  }
}

// =============================================================================
// Provider-Specific Implementations
// =============================================================================

// Shopify
async function checkShopifyInventory(
  integration: Integration,
  productName: string,
  quantity: number
): Promise<InventoryResult> {
  // Search for product by name
  const response = await fetch(
    `https://${integration.shopDomain}/admin/api/2024-01/products.json?title=${encodeURIComponent(productName)}&limit=5`,
    {
      headers: {
        "X-Shopify-Access-Token": integration.accessToken,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch Shopify products");
  }

  const data = await response.json();
  const products = data.products || [];

  if (products.length === 0) {
    return {
      available: false,
      productName,
      message: `I couldn't find a product called "${productName}" in our inventory. Could you give me more details about what you're looking for?`,
    };
  }

  // Get the first matching product
  const product = products[0];
  const variant = product.variants?.[0];
  const inventoryQuantity = variant?.inventory_quantity || 0;
  const available = inventoryQuantity >= quantity;

  return {
    available,
    quantity: inventoryQuantity,
    productName: product.title,
    price: variant?.price ? parseFloat(variant.price) : undefined,
    message: available
      ? `Yes, we have "${product.title}" in stock! We currently have ${inventoryQuantity} available${variant?.price ? ` at $${variant.price} each` : ""}.`
      : inventoryQuantity > 0
        ? `We have "${product.title}" but only ${inventoryQuantity} in stock. You requested ${quantity}. Would you like to proceed with what we have?`
        : `I'm sorry, "${product.title}" is currently out of stock. Would you like me to take your information and notify you when it's back?`,
  };
}

async function getShopifyOrderStatus(
  integration: Integration,
  orderNumber?: string,
  customerPhone?: string
): Promise<OrderResult> {
  let url = `https://${integration.shopDomain}/admin/api/2024-01/orders.json?limit=1&status=any`;

  if (orderNumber) {
    url += `&name=%23${orderNumber}`;
  } else if (customerPhone) {
    // Normalize phone number
    const cleanPhone = customerPhone.replace(/\D/g, "");
    url += `&phone=${cleanPhone}`;
  }

  const response = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": integration.accessToken,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Shopify orders");
  }

  const data = await response.json();
  const orders = data.orders || [];

  if (orders.length === 0) {
    return {
      found: false,
      message: orderNumber
        ? `I couldn't find an order with number ${orderNumber}. Could you double-check the order number?`
        : `I couldn't find any recent orders with your phone number. Do you have an order number I could look up?`,
    };
  }

  const order = orders[0];
  const fulfillment = order.fulfillments?.[0];
  const tracking = fulfillment?.tracking_number;

  const statusMap: Record<string, string> = {
    pending: "being processed",
    open: "being prepared",
    fulfilled: "shipped",
    cancelled: "cancelled",
  };

  const status = statusMap[order.fulfillment_status] || order.fulfillment_status || "being processed";

  return {
    found: true,
    orderNumber: order.name,
    status,
    items: order.line_items?.map((item: { title: string; quantity: number }) => ({
      name: item.title,
      quantity: item.quantity,
    })),
    trackingNumber: tracking,
    message: tracking
      ? `Order ${order.name} has been ${status}. Your tracking number is ${tracking}.`
      : `Order ${order.name} is currently ${status}.`,
  };
}

// Square
async function checkSquareInventory(
  integration: Integration,
  productName: string,
  quantity: number
): Promise<InventoryResult> {
  const SQUARE_VERSION = "2024-01-18";
  const baseUrl = "https://connect.squareup.com/v2";

  // Step 1: Search for the product in the catalog by name
  const catalogResponse = await fetch(`${baseUrl}/catalog/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integration.accessToken}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      object_types: ["ITEM"],
      query: {
        text_query: {
          keywords: [productName],
        },
      },
      limit: 10,
    }),
  });

  if (!catalogResponse.ok) {
    const errorText = await catalogResponse.text();
    logError("Square Catalog API", new Error(`${catalogResponse.status}: ${errorText}`));

    if (catalogResponse.status === 401) {
      throw new Error("Square authentication failed");
    }
    throw new Error(`Failed to search Square catalog: ${catalogResponse.status}`);
  }

  const catalogData = await catalogResponse.json();
  const items = catalogData.objects || [];

  if (items.length === 0) {
    return {
      available: false,
      productName,
      message: `I couldn't find a product called "${productName}" in our inventory. Could you give me more details about what you're looking for?`,
    };
  }

  // Get the first matching item
  const item = items[0];
  const itemData = item.item_data || {};
  const itemName = itemData.name || productName;

  // Get the first variation (Square items have variations for pricing/inventory)
  const variations = itemData.variations || [];
  const variation = variations[0];

  if (!variation) {
    return {
      available: false,
      productName: itemName,
      message: `I found "${itemName}" but couldn't retrieve its availability. Would you like me to take a message and have someone call you back?`,
    };
  }

  const variationId = variation.id;
  const variationData = variation.item_variation_data || {};

  // Extract price from the variation
  const priceMoney = variationData.price_money;
  const price = priceMoney ? priceMoney.amount / 100 : undefined; // Square stores amounts in cents

  // Step 2: Get inventory counts for this variation
  const locationId = integration.locationId || (integration.metadata.location_id as string);

  const inventoryResponse = await fetch(`${baseUrl}/inventory/counts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integration.accessToken}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      catalog_object_ids: [variationId],
      location_ids: locationId ? [locationId] : undefined,
    }),
  });

  if (!inventoryResponse.ok) {
    const errorText = await inventoryResponse.text();
    logError("Square Inventory API", new Error(`${inventoryResponse.status}: ${errorText}`));

    // If inventory lookup fails, we can still return product info without quantity
    return {
      available: true, // Assume available if we can't check inventory
      productName: itemName,
      price,
      message: `I found "${itemName}"${price ? ` at $${price.toFixed(2)}` : ""}. I'm having trouble checking the exact quantity, but would you like me to place an order?`,
    };
  }

  const inventoryData = await inventoryResponse.json();
  const counts = inventoryData.counts || [];

  // Sum up inventory across locations if no specific location
  let totalQuantity = 0;
  for (const count of counts) {
    if (count.state === "IN_STOCK") {
      totalQuantity += parseFloat(count.quantity) || 0;
    }
  }

  const inventoryQuantity = Math.floor(totalQuantity);
  const available = inventoryQuantity >= quantity;

  // Build variant information if there are multiple variations
  const variants = variations.length > 1
    ? variations.map((v: { item_variation_data?: { name?: string }; id: string }) => {
        const vData = v.item_variation_data || {};
        const vCount = counts.find((c: { catalog_object_id: string }) => c.catalog_object_id === v.id);
        const vQuantity = vCount ? parseFloat(vCount.quantity) || 0 : 0;
        return {
          name: vData.name || "Default",
          available: vQuantity > 0,
        };
      })
    : undefined;

  return {
    available,
    quantity: inventoryQuantity,
    productName: itemName,
    price,
    variants,
    message: available
      ? `Yes, we have "${itemName}" in stock! We currently have ${inventoryQuantity} available${price ? ` at $${price.toFixed(2)} each` : ""}.`
      : inventoryQuantity > 0
        ? `We have "${itemName}" but only ${inventoryQuantity} in stock. You requested ${quantity}. Would you like to proceed with what we have?`
        : `I'm sorry, "${itemName}" is currently out of stock. Would you like me to take your information and notify you when it's back?`,
  };
}

async function getSquareOrderStatus(
  integration: Integration,
  orderNumber?: string,
  customerPhone?: string
): Promise<OrderResult> {
  const SQUARE_VERSION = "2024-01-18";
  const baseUrl = "https://connect.squareup.com/v2";

  const locationId = integration.locationId || (integration.metadata.location_id as string);

  // Build the search query based on available parameters
  interface SquareSearchQuery {
    filter?: {
      customer_filter?: {
        customer_ids?: string[];
      };
      state_filter?: {
        states: string[];
      };
    };
    sort?: {
      sort_field: string;
      sort_order: string;
    };
  }

  const searchQuery: SquareSearchQuery = {
    filter: {
      state_filter: {
        states: ["OPEN", "COMPLETED", "CANCELED"],
      },
    },
    sort: {
      sort_field: "CREATED_AT",
      sort_order: "DESC",
    },
  };

  // If we have a phone number, we need to first look up the customer
  let customerId: string | null = null;
  if (customerPhone && !orderNumber) {
    // Normalize phone number
    const cleanPhone = customerPhone.replace(/\D/g, "");

    // Search for customer by phone
    const customerResponse = await fetch(`${baseUrl}/customers/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        "Square-Version": SQUARE_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          filter: {
            phone_number: {
              exact: cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`,
            },
          },
        },
        limit: 1,
      }),
    });

    if (customerResponse.ok) {
      const customerData = await customerResponse.json();
      const customers = customerData.customers || [];
      if (customers.length > 0) {
        customerId = customers[0].id;
      }
    }

    if (!customerId) {
      return {
        found: false,
        message: `I couldn't find any orders with your phone number. Do you have an order number I could look up?`,
      };
    }

    // Add customer filter to the search
    searchQuery.filter!.customer_filter = {
      customer_ids: [customerId],
    };
  }

  // Search for orders
  const searchBody: {
    location_ids?: string[];
    query: SquareSearchQuery;
    limit: number;
  } = {
    query: searchQuery,
    limit: 10,
  };

  if (locationId) {
    searchBody.location_ids = [locationId];
  }

  const ordersResponse = await fetch(`${baseUrl}/orders/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integration.accessToken}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(searchBody),
  });

  if (!ordersResponse.ok) {
    const errorText = await ordersResponse.text();
    logError("Square Orders API", new Error(`${ordersResponse.status}: ${errorText}`));

    if (ordersResponse.status === 401) {
      throw new Error("Square authentication failed");
    }
    throw new Error(`Failed to search Square orders: ${ordersResponse.status}`);
  }

  const ordersData = await ordersResponse.json();
  const orders = ordersData.orders || [];

  if (orders.length === 0) {
    return {
      found: false,
      message: orderNumber
        ? `I couldn't find an order with number ${orderNumber}. Could you double-check the order number?`
        : `I couldn't find any recent orders. Do you have an order number I could look up?`,
    };
  }

  // If we have an order number, find the matching order
  let order = orders[0];
  if (orderNumber) {
    // Square order IDs can be matched by the reference_id or the order ID itself
    const cleanOrderNumber = orderNumber.replace(/^#/, "").toUpperCase();
    const matchedOrder = orders.find((o: { id: string; reference_id?: string }) => {
      const orderId = o.id.toUpperCase();
      const refId = (o.reference_id || "").toUpperCase();
      return (
        orderId === cleanOrderNumber ||
        orderId.includes(cleanOrderNumber) ||
        refId === cleanOrderNumber ||
        refId.includes(cleanOrderNumber)
      );
    });

    if (matchedOrder) {
      order = matchedOrder;
    } else if (orderNumber) {
      // If specific order number was provided but not found
      return {
        found: false,
        message: `I couldn't find an order with number ${orderNumber}. Could you double-check the order number?`,
      };
    }
  }

  // Map Square order states to user-friendly statuses
  const stateMap: Record<string, string> = {
    OPEN: "being processed",
    COMPLETED: "completed",
    CANCELED: "cancelled",
    DRAFT: "pending",
  };

  // Check fulfillment status for more detailed tracking
  const fulfillments = order.fulfillments || [];
  const fulfillment = fulfillments[0];

  let status = stateMap[order.state] || order.state || "being processed";
  let trackingNumber: string | undefined;
  let estimatedDelivery: string | undefined;

  if (fulfillment) {
    const fulfillmentState = fulfillment.state;
    const fulfillmentStateMap: Record<string, string> = {
      PROPOSED: "being prepared",
      RESERVED: "being prepared",
      PREPARED: "ready for pickup",
      COMPLETED: "delivered",
      CANCELED: "cancelled",
      FAILED: "had an issue",
    };

    if (fulfillmentStateMap[fulfillmentState]) {
      status = fulfillmentStateMap[fulfillmentState];
    }

    // Check for shipment details
    const shipmentDetails = fulfillment.shipment_details;
    if (shipmentDetails) {
      trackingNumber = shipmentDetails.tracking_number;
      if (shipmentDetails.expected_shipped_at) {
        const expectedDate = new Date(shipmentDetails.expected_shipped_at);
        estimatedDelivery = expectedDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        });
      }
    }
  }

  // Extract line items
  const lineItems = order.line_items || [];
  const items = lineItems.map((item: { name: string; quantity: string }) => ({
    name: item.name,
    quantity: parseInt(item.quantity, 10) || 1,
  }));

  // Format the order number for display (use reference_id if available, otherwise truncated order ID)
  const displayOrderNumber = order.reference_id || `#${order.id.substring(0, 8).toUpperCase()}`;

  // Build the response message
  let message = `Order ${displayOrderNumber} is currently ${status}.`;

  if (trackingNumber) {
    message = `Order ${displayOrderNumber} has been shipped. Your tracking number is ${trackingNumber}.`;
  }

  if (estimatedDelivery && !trackingNumber) {
    message += ` Expected delivery is ${estimatedDelivery}.`;
  }

  return {
    found: true,
    orderNumber: displayOrderNumber,
    status,
    items,
    trackingNumber,
    estimatedDelivery,
    message,
  };
}

// HubSpot
async function createHubSpotContact(
  integration: Integration,
  leadData: {
    name: string;
    email?: string;
    phone: string;
    interest?: string;
    notes?: string;
  }
): Promise<LeadResult> {
  const [firstname, ...lastNameParts] = leadData.name.split(" ");
  const lastname = lastNameParts.join(" ") || "";

  const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integration.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        firstname,
        lastname,
        email: leadData.email || "",
        phone: leadData.phone,
        hs_lead_status: "NEW",
        description: [
          leadData.interest ? `Interest: ${leadData.interest}` : "",
          leadData.notes ? `Notes: ${leadData.notes}` : "",
          "Created by Koya AI Receptionist",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create HubSpot contact");
  }

  const data = await response.json();

  return {
    success: true,
    leadId: data.id,
    message: "I've added your information to our system. Someone will follow up with you shortly!",
  };
}

// Salesforce
async function createSalesforceLead(
  integration: Integration,
  leadData: {
    name: string;
    email?: string;
    phone: string;
    interest?: string;
    notes?: string;
  }
): Promise<LeadResult> {
  const [firstName, ...lastNameParts] = leadData.name.split(" ");
  const lastName = lastNameParts.join(" ") || "Unknown";

  const instanceUrl = integration.metadata.instance_url as string;

  const response = await fetch(`${instanceUrl}/services/data/v59.0/sobjects/Lead`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integration.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      FirstName: firstName,
      LastName: lastName,
      Email: leadData.email,
      Phone: leadData.phone,
      Company: "Inbound Call",
      LeadSource: "Phone",
      Description: [
        leadData.interest ? `Interest: ${leadData.interest}` : "",
        leadData.notes ? `Notes: ${leadData.notes}` : "",
        "Created by Koya AI Receptionist",
      ]
        .filter(Boolean)
        .join("\n"),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error[0]?.message || "Failed to create Salesforce lead");
  }

  const data = await response.json();

  return {
    success: true,
    leadId: data.id,
    message: "I've added your information to our system. Someone will follow up with you shortly!",
  };
}

// Stripe
async function createStripePaymentLink(
  integration: Integration,
  amount: number,
  description: string,
  customerPhone: string,
  _sendReceipt: boolean
): Promise<PaymentResult> {
  // Import Stripe dynamically to avoid loading it when not needed
  const Stripe = (await import("stripe")).default;

  // Use the connected account ID for Stripe Connect
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2025-02-24.acacia",
  });

  // First create a product and price
  const product = await stripe.products.create(
    {
      name: description,
    },
    {
      stripeAccount: integration.accountId,
    }
  );

  const price = await stripe.prices.create(
    {
      product: product.id,
      unit_amount: Math.round(amount * 100), // Convert to cents
      currency: "usd",
    },
    {
      stripeAccount: integration.accountId,
    }
  );

  // Create a payment link using the price
  const paymentLink = await stripe.paymentLinks.create(
    {
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      after_completion: {
        type: "redirect",
        redirect: {
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment/success`,
        },
      },
    },
    {
      stripeAccount: integration.accountId,
    }
  );

  // Send the payment link via SMS using Twilio directly
  if (paymentLink.url) {
    const { getTwilioClient, isTwilioConfigured } = await import("@/lib/twilio");
    if (isTwilioConfigured()) {
      const client = getTwilioClient();
      await client.messages.create({
        to: customerPhone,
        from: process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID,
        body: `Here's your secure payment link for $${amount.toFixed(2)} (${description}): ${paymentLink.url}`,
      });
    }
  }

  return {
    success: true,
    paymentLink: paymentLink.url,
    message: `I've sent a secure payment link to your phone for $${amount.toFixed(2)}. Please click the link to complete your payment.`,
  };
}

// OpenTable
async function checkOpenTableAvailability(
  integration: Integration,
  date: string,
  partySize: number,
  time?: string
): Promise<ReservationResult> {
  const restaurantId = integration.metadata.restaurant_id as string;

  if (!restaurantId) {
    logError("OpenTable Integration", new Error("Missing restaurant_id in metadata"));
    return {
      available: false,
      message:
        "I'm having trouble accessing the reservation system. Would you like me to take a message and have someone call you back?",
    };
  }

  // Build the query parameters
  const params = new URLSearchParams({
    date: date, // YYYY-MM-DD format
    party_size: partySize.toString(),
  });

  if (time) {
    params.append("time", time); // HH:MM format
  }

  const response = await fetch(
    `https://platform.opentable.com/availability/${restaurantId}?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logError("OpenTable API", new Error(`${response.status}: ${errorText}`));

    if (response.status === 401) {
      return {
        available: false,
        message:
          "I'm having trouble accessing the reservation system right now. Would you like me to take a message and have someone call you back?",
      };
    }

    if (response.status === 404) {
      return {
        available: false,
        message:
          "I couldn't find the restaurant in our reservation system. Would you like me to take a message and have someone call you back?",
      };
    }

    throw new Error(`OpenTable API error: ${response.status}`);
  }

  const data = await response.json();

  // Parse the available time slots from the response
  // OpenTable response typically includes an array of available slots
  const availableSlots = data.availability || data.time_slots || [];

  if (availableSlots.length === 0) {
    // Format the date for a friendly message
    const formattedDate = formatDateForDisplay(date);

    return {
      available: false,
      times: [],
      message: time
        ? `I'm sorry, there are no tables available for ${partySize} ${partySize === 1 ? "person" : "people"} at ${formatTimeForDisplay(time)} on ${formattedDate}. Would you like me to check a different time or date?`
        : `I'm sorry, there are no tables available for ${partySize} ${partySize === 1 ? "person" : "people"} on ${formattedDate}. Would you like me to check a different date?`,
    };
  }

  // Transform the available slots into our format
  const times = availableSlots.map((slot: { time: string; date_time?: string }) => ({
    time: slot.time || slot.date_time?.split("T")[1]?.substring(0, 5) || "",
    partySize: partySize,
  }));

  // Format the times for the response message
  const formattedTimes = times
    .slice(0, 5) // Limit to first 5 times for the spoken response
    .map((t: { time: string }) => formatTimeForDisplay(t.time))
    .join(", ");

  const formattedDate = formatDateForDisplay(date);

  return {
    available: true,
    times,
    message: `Great news! We have availability for ${partySize} ${partySize === 1 ? "person" : "people"} on ${formattedDate}. Available times include ${formattedTimes}. Would you like me to book one of these times for you?`,
  };
}

// Mindbody
async function checkMindbodyAvailability(
  integration: Integration,
  date: string,
  partySize: number,
  time?: string
): Promise<ReservationResult> {
  const siteId = integration.metadata.site_id as string;
  const classScheduleIds = integration.metadata.class_schedule_ids as string[] | undefined;

  if (!siteId) {
    logError("Mindbody Integration", new Error("Missing site_id in metadata"));
    return {
      available: false,
      message:
        "I'm having trouble accessing the appointment system. Would you like me to take a message and have someone call you back?",
    };
  }

  // Build the query parameters
  // StartDate and EndDate are in the same day for availability check
  const params = new URLSearchParams({
    StartDate: date, // YYYY-MM-DD format
    EndDate: date,   // Same day for single-day availability
  });

  // Add class schedule IDs if configured
  if (classScheduleIds && classScheduleIds.length > 0) {
    classScheduleIds.forEach((id) => {
      params.append("ClassScheduleIds", id);
    });
  }

  const response = await fetch(
    `https://api.mindbodyonline.com/public/v6/class/classes?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        SiteId: siteId,
        "Api-Key": (integration.metadata.api_key as string) || "",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logError("Mindbody API", new Error(`${response.status}: ${errorText}`));

    if (response.status === 401) {
      return {
        available: false,
        message:
          "I'm having trouble accessing the appointment system right now. Would you like me to take a message and have someone call you back?",
      };
    }

    if (response.status === 403) {
      return {
        available: false,
        message:
          "I don't have permission to access the appointment system. Would you like me to take a message and have someone call you back?",
      };
    }

    throw new Error(`Mindbody API error: ${response.status}`);
  }

  const data = await response.json();

  // Parse the available classes/appointments from the response
  const classes = data.Classes || [];

  // Filter classes that have availability (not full)
  const availableClasses = classes.filter((cls: {
    IsCanceled?: boolean;
    MaxCapacity?: number;
    TotalBooked?: number;
    IsAvailable?: boolean;
  }) => {
    // Check if class is not canceled and has spots available
    if (cls.IsCanceled) return false;
    if (cls.IsAvailable === false) return false;
    if (cls.MaxCapacity && cls.TotalBooked && cls.TotalBooked >= cls.MaxCapacity) return false;
    return true;
  });

  // If a specific time was requested, filter for classes around that time
  let filteredClasses = availableClasses;
  if (time) {
    const requestedHour = parseInt(time.split(":")[0], 10);
    filteredClasses = availableClasses.filter((cls: { StartDateTime?: string }) => {
      if (!cls.StartDateTime) return false;
      const classTime = new Date(cls.StartDateTime);
      const classHour = classTime.getHours();
      // Allow classes within 2 hours of requested time
      return Math.abs(classHour - requestedHour) <= 2;
    });
  }

  if (filteredClasses.length === 0) {
    const formattedDate = formatDateForDisplay(date);

    return {
      available: false,
      times: [],
      message: time
        ? `I'm sorry, there are no appointments available around ${formatTimeForDisplay(time)} on ${formattedDate}. Would you like me to check a different time or date?`
        : `I'm sorry, there are no appointments available on ${formattedDate}. Would you like me to check a different date?`,
    };
  }

  // Transform the available classes into our format
  const times = filteredClasses.map((cls: {
    StartDateTime?: string;
    Name?: string;
    ClassDescription?: { Name?: string };
  }) => {
    const startTime = cls.StartDateTime
      ? new Date(cls.StartDateTime).toTimeString().substring(0, 5)
      : "";
    return {
      time: startTime,
      partySize: 1, // Appointments are typically for one person
      className: cls.Name || cls.ClassDescription?.Name || "Appointment",
    };
  });

  // Sort by time
  times.sort((a: { time: string }, b: { time: string }) => a.time.localeCompare(b.time));

  // Format the times for the response message
  const formattedTimes = times
    .slice(0, 5) // Limit to first 5 times for the spoken response
    .map((t: { time: string; className?: string }) => {
      const timeStr = formatTimeForDisplay(t.time);
      return t.className ? `${timeStr} for ${t.className}` : timeStr;
    })
    .join(", ");

  const formattedDate = formatDateForDisplay(date);

  return {
    available: true,
    times,
    message: `Great news! We have availability on ${formattedDate}. Available times include ${formattedTimes}. Would you like me to book one of these for you?`,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format a date string (YYYY-MM-DD) for display in spoken form
 */
function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  };
  return date.toLocaleDateString("en-US", options);
}

/**
 * Format a time string (HH:MM) for display in spoken form
 */
function formatTimeForDisplay(timeStr: string): string {
  if (!timeStr) return "";

  const [hours, minutes] = timeStr.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes === 0 ? "" : `:${minutes.toString().padStart(2, "0")}`;

  return `${displayHours}${displayMinutes} ${period}`;
}
