"use client";

/**
 * Integrations Client Component
 * Displays and manages third-party service connections
 */

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShoppingBag,
  CreditCard,
  Users,
  Calendar,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
  Puzzle,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { WebhooksSection } from "./webhooks-section";

// Integrations that require additional input before OAuth
const _INTEGRATIONS_REQUIRING_INPUT = ["shopify"];

// Integration type definitions
interface Integration {
  id: string;
  provider: string;
  is_active: boolean;
  shop_domain?: string;
  location_id?: string;
  account_id?: string;
  created_at: string;
}

interface IntegrationConfig {
  id: string;
  name: string;
  description: string;
  category: "ecommerce" | "payments" | "crm" | "industry";
  icon: React.ReactNode;
  color: string;
  capabilities: string[];
  comingSoon?: boolean;
}

// Available integrations configuration
const INTEGRATIONS: IntegrationConfig[] = [
  // E-Commerce
  {
    id: "shopify",
    name: "Shopify",
    description: "Check inventory, look up orders, and provide product info during calls",
    category: "ecommerce",
    icon: <ShoppingBag className="h-6 w-6" />,
    color: "bg-[#96BF48]",
    capabilities: ["Inventory lookup", "Order status", "Product details"],
  },
  {
    id: "square",
    name: "Square",
    description: "Access your Square catalog and order history during customer calls",
    category: "ecommerce",
    icon: <ShoppingBag className="h-6 w-6" />,
    color: "bg-black",
    capabilities: ["Inventory lookup", "Order status", "Payment status"],
  },
  // Payments
  {
    id: "stripe_connect",
    name: "Stripe",
    description: "Collect payments during calls via SMS payment links",
    category: "payments",
    icon: <CreditCard className="h-6 w-6" />,
    color: "bg-[#635BFF]",
    capabilities: ["Payment collection", "Invoice sending", "Refund status"],
  },
  // CRM
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Automatically create and update contacts from interested callers",
    category: "crm",
    icon: <Users className="h-6 w-6" />,
    color: "bg-[#FF7A59]",
    capabilities: ["Contact creation", "Deal tracking", "Activity logging"],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Create leads and log call activities in your Salesforce CRM",
    category: "crm",
    icon: <Users className="h-6 w-6" />,
    color: "bg-[#00A1E0]",
    capabilities: ["Lead creation", "Opportunity tracking", "Task creation"],
  },
  // Industry-specific
  {
    id: "opentable",
    name: "OpenTable",
    description: "Check restaurant availability and make reservations",
    category: "industry",
    icon: <Calendar className="h-6 w-6" />,
    color: "bg-[#DA3743]",
    capabilities: ["Availability check", "Reservation booking", "Table management"],
  },
  {
    id: "mindbody",
    name: "Mindbody",
    description: "Book appointments and check class availability for wellness businesses",
    category: "industry",
    icon: <Calendar className="h-6 w-6" />,
    color: "bg-[#00B4E3]",
    capabilities: ["Class scheduling", "Appointment booking", "Package lookup"],
  },
];

const CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
  ecommerce: {
    label: "E-Commerce",
    description: "Connect your online store to check inventory and orders",
  },
  payments: {
    label: "Payments",
    description: "Collect payments from callers via SMS payment links",
  },
  crm: {
    label: "CRM",
    description: "Automatically create leads from interested callers",
  },
  industry: {
    label: "Industry-Specific",
    description: "Specialized integrations for restaurants and wellness businesses",
  },
};

interface IntegrationsClientProps {
  businessId: string;
  initialIntegrations: Integration[];
}

export function IntegrationsClient({ businessId: _businessId, initialIntegrations }: IntegrationsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [disconnectingProvider, setDisconnectingProvider] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Shopify-specific state
  const [showShopifyModal, setShowShopifyModal] = useState(false);
  const [shopifyDomain, setShopifyDomain] = useState("");
  const [shopifyError, setShopifyError] = useState("");

  // Handle OAuth callback URL parameters
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success) {
      toast({
        title: success,
        variant: "success",
      });
      router.replace("/integrations", { scroll: false });
    } else if (error) {
      toast({
        title: error,
        variant: "destructive",
      });
      router.replace("/integrations", { scroll: false });
    }
  }, [searchParams, router]);

  // Check if an integration is connected
  const isConnected = (providerId: string) => {
    return integrations.some((i) => i.provider === providerId && i.is_active);
  };

  // Get integration details
  const getIntegration = (providerId: string) => {
    return integrations.find((i) => i.provider === providerId);
  };

  // Handle connect click
  const handleConnect = async (config: IntegrationConfig) => {
    if (config.comingSoon) {
      toast({ title: `${config.name} integration coming soon!` });
      return;
    }

    // Show modal for integrations that need additional input
    if (config.id === "shopify") {
      setShopifyDomain("");
      setShopifyError("");
      setShowShopifyModal(true);
      return;
    }

    // Direct OAuth flow for other integrations
    await initiateOAuthFlow(config.id, {});
  };

  // Initiate OAuth flow with optional extra params
  const initiateOAuthFlow = async (providerId: string, extraParams: Record<string, string>) => {
    setConnectingProvider(providerId);

    try {
      const response = await fetch(`/api/integrations/${providerId}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: "/integrations",
          ...extraParams,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate connection");
      }

      if (data.authUrl) {
        // Redirect to OAuth provider
        window.location.href = data.authUrl;
      } else {
        throw new Error("No authorization URL received");
      }
    } catch (error) {
      toast({ title: "Connection failed", description: error instanceof Error ? error.message : "Failed to connect", variant: "destructive" });
      setConnectingProvider(null);
    }
  };

  // Handle Shopify connection with store domain
  const handleShopifyConnect = async () => {
    // Validate domain
    let domain = shopifyDomain.trim().toLowerCase();

    // Remove protocol if present
    domain = domain.replace(/^https?:\/\//, "");
    // Remove trailing slash
    domain = domain.replace(/\/$/, "");

    // Add .myshopify.com if not present
    if (!domain.includes(".myshopify.com")) {
      domain = `${domain}.myshopify.com`;
    }

    // Basic validation
    if (!domain || domain === ".myshopify.com") {
      setShopifyError("Please enter your store name");
      return;
    }

    // Validate format
    const shopifyDomainRegex = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
    if (!shopifyDomainRegex.test(domain)) {
      setShopifyError("Please enter a valid Shopify store name (letters, numbers, and hyphens only)");
      return;
    }

    setShopifyError("");
    setShowShopifyModal(false);
    await initiateOAuthFlow("shopify", { shopDomain: domain });
  };

  // Handle disconnect click
  const handleDisconnect = async (providerId: string) => {
    setIsDisconnecting(true);
    try {
      const response = await fetch(`/api/integrations/${providerId}/disconnect`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect");
      }

      setIntegrations((prev) => prev.filter((i) => i.provider !== providerId));
      toast({ title: "Integration disconnected", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Failed to disconnect integration", variant: "destructive" });
    } finally {
      setIsDisconnecting(false);
      setDisconnectingProvider(null);
    }
  };

  // Group integrations by category
  const categories = ["ecommerce", "payments", "crm", "industry"] as const;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Puzzle className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">
            Connect third-party services to enhance Koya&apos;s capabilities during calls
          </p>
        </div>
      </div>

      {/* Info banner */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardContent className="flex items-start gap-3 pt-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium">How integrations work with Koya</p>
            <p className="mt-1 text-blue-700 dark:text-blue-300">
              When connected, Koya can automatically check inventory, create leads, process
              payments, and more during live calls. Callers can ask questions like &quot;Is this in
              stock?&quot; or &quot;Can I pay over the phone?&quot; and Koya will handle it.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Integration categories */}
      {categories.map((category) => {
        const categoryConfig = CATEGORY_LABELS[category];
        const categoryIntegrations = INTEGRATIONS.filter((i) => i.category === category);

        return (
          <div key={category} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{categoryConfig.label}</h2>
              <p className="text-sm text-muted-foreground">{categoryConfig.description}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categoryIntegrations.map((config) => {
                const connected = isConnected(config.id);
                const integration = getIntegration(config.id);
                const isConnecting = connectingProvider === config.id;

                return (
                  <Card
                    key={config.id}
                    className={`relative overflow-hidden transition-shadow hover:shadow-md ${
                      config.comingSoon ? "opacity-75" : ""
                    }`}
                  >
                    {config.comingSoon && (
                      <div className="absolute right-2 top-2">
                        <Badge variant="secondary" className="text-xs">
                          Coming Soon
                        </Badge>
                      </div>
                    )}

                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg text-white ${config.color}`}
                        >
                          {config.icon}
                        </div>
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2 text-base">
                            {config.name}
                            {connected && (
                              <Badge
                                variant="outline"
                                className="border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                              >
                                <Check className="mr-1 h-3 w-3" />
                                Connected
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="mt-1 text-xs">
                            {config.description}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      {/* Capabilities */}
                      <div className="mb-4 flex flex-wrap gap-1">
                        {config.capabilities.map((cap) => (
                          <Badge
                            key={cap}
                            variant="secondary"
                            className="text-xs font-normal"
                          >
                            {cap}
                          </Badge>
                        ))}
                      </div>

                      {/* Connection details */}
                      {connected && integration && (
                        <div className="mb-3 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                          {integration.shop_domain && (
                            <p>Store: {integration.shop_domain}</p>
                          )}
                          {integration.location_id && (
                            <p>Location: {integration.location_id}</p>
                          )}
                          {integration.account_id && (
                            <p>Account: {integration.account_id.slice(0, 12)}...</p>
                          )}
                          <p>
                            Connected{" "}
                            {new Date(integration.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        {connected ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => setDisconnectingProvider(config.id)}
                            >
                              Disconnect
                            </Button>
                            {!config.comingSoon && (
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                              >
                                <a
                                  href={`/api/integrations/${config.id}/settings`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleConnect(config)}
                            disabled={isConnecting || config.comingSoon}
                          >
                            {isConnecting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              <>Connect {config.name}</>
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Webhooks Section - for Zapier/Make/custom integrations */}
      <div className="border-t pt-6">
        <WebhooksSection />
      </div>

      {/* Disconnect confirmation dialog */}
      <Dialog
        open={!!disconnectingProvider}
        onOpenChange={() => setDisconnectingProvider(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Integration?</DialogTitle>
            <DialogDescription>
              Koya will no longer be able to access{" "}
              {INTEGRATIONS.find((i) => i.id === disconnectingProvider)?.name} during calls.
              You can reconnect at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDisconnectingProvider(null)}
              disabled={isDisconnecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => disconnectingProvider && handleDisconnect(disconnectingProvider)}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                "Disconnect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shopify store domain modal */}
      <Dialog open={showShopifyModal} onOpenChange={setShowShopifyModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#96BF48] text-white">
                <Store className="h-4 w-4" />
              </div>
              Connect Your Shopify Store
            </DialogTitle>
            <DialogDescription>
              Enter your Shopify store name to connect. This allows Koya to check inventory
              and look up orders during customer calls.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="shopify-domain">Your Shopify Store Name</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="shopify-domain"
                  placeholder="your-store-name"
                  value={shopifyDomain}
                  onChange={(e) => {
                    setShopifyDomain(e.target.value);
                    setShopifyError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleShopifyConnect();
                    }
                  }}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">.myshopify.com</span>
              </div>
              {shopifyError && (
                <p className="text-sm text-destructive">{shopifyError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Find this in your Shopify admin URL: https://<strong>your-store-name</strong>.myshopify.com
              </p>
            </div>

            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                <strong>What Koya can do with Shopify:</strong>
              </p>
              <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                <li>Check if products are in stock</li>
                <li>Look up order status by order number</li>
                <li>Provide product details to callers</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowShopifyModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleShopifyConnect}
              disabled={!shopifyDomain.trim()}
              className="bg-[#96BF48] hover:bg-[#7a9c3a]"
            >
              Connect Shopify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
