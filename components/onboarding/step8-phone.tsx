"use client";

/**
 * Koya Caller - Onboarding Step 8: Phone Number Setup
 * Spec Reference: Part 5, Lines 418-520
 * 
 * Features:
 * - Choice: New number vs. forward existing vs. use existing Twilio number
 * - Area code selection
 * - Twilio number search & provisioning (real API)
 * - Provider-specific forwarding instructions
 * - Use existing TWILIO_PHONE_NUMBER from environment
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  PhoneForwarded,
  Search,
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOnboarding } from "@/lib/onboarding/context";
import {
  getCarrierInstructions,
  formatEnableCode,
  type CarrierInstructions,
} from "@/lib/onboarding/carrier-instructions";
import {
  type Step8FormData,
  type PhoneSetupType,
  type PhoneProvider,
  DEFAULT_STEP8_DATA,
  PHONE_PROVIDER_OPTIONS,
} from "@/types/onboarding";

// Format phone number for display: +14155551234 -> (415) 555-1234
function formatPhoneNumber(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    const prefix = digits.slice(4, 7);
    const line = digits.slice(7, 11);
    return `(${area}) ${prefix}-${line}`;
  }
  return e164;
}

// Extended setup type to include existing number
type ExtendedSetupType = PhoneSetupType | "existing";

export function Step8PhoneNumber() {
  const router = useRouter();
  const { state, setStep8Data, completeStep } = useOnboarding();
  
  // Form state
  const [formData, setFormData] = useState<Step8FormData>(
    state.step8Data || DEFAULT_STEP8_DATA
  );
  
  // UI state
  const [isSearching, setIsSearching] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [configureError, setConfigureError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Existing number state
  const [existingNumber, setExistingNumber] = useState<string | null>(null);
  const [hasExistingNumber, setHasExistingNumber] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [extendedSetupType, setExtendedSetupType] = useState<ExtendedSetupType | null>(
    formData.setupType
  );
  
  // Check for existing Twilio number on mount
  useEffect(() => {
    async function checkExistingNumber() {
      try {
        const response = await fetch("/api/twilio/configure");
        if (response.ok) {
          const data = await response.json();
          setHasExistingNumber(data.hasExistingNumber);
          setExistingNumber(data.phoneNumber);
        }
      } catch (_error) {
        // Error handled silently
      } finally {
        setCheckingExisting(false);
      }
    }
    checkExistingNumber();
  }, []);
  
  // Get carrier instructions when carrier is selected
  const carrierInstructions: CarrierInstructions | null =
    formData.carrier ? getCarrierInstructions(formData.carrier) : null;
  
  // Handle setup type selection
  const handleSetupTypeChange = (type: ExtendedSetupType) => {
    setExtendedSetupType(type);
    if (type !== "existing") {
      setFormData((prev) => ({
        ...prev,
        setupType: type as PhoneSetupType,
        // Reset relevant fields when changing type
        carrier: null,
        forwardedFrom: null,
        forwardingConfirmed: false,
      }));
    }
    setSearchError(null);
    setProvisionError(null);
    setConfigureError(null);
  };
  
  // Handle using existing Twilio number
  const handleUseExistingNumber = async () => {
    if (!existingNumber) return;
    
    setIsConfiguring(true);
    setConfigureError(null);
    
    try {
      const response = await fetch("/api/twilio/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: state.businessId }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || "Failed to configure number");
      }
      
      const data = await response.json();
      
      setFormData((prev) => ({
        ...prev,
        setupType: "new", // Treat as "new" for flow purposes
        selectedNumber: existingNumber,
        twilioSid: data.sid,
        isProvisioned: true,
      }));
      
    } catch (error) {
      setConfigureError(
        error instanceof Error ? error.message : "Failed to configure existing number"
      );
    } finally {
      setIsConfiguring(false);
    }
  };
  
  // Handle area code search
  const handleSearchNumbers = async () => {
    if (!formData.areaCode || formData.areaCode.length !== 3) {
      setSearchError("Please enter a valid 3-digit area code");
      return;
    }
    
    setIsSearching(true);
    setSearchError(null);
    
    try {
      const response = await fetch("/api/twilio/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaCode: formData.areaCode }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to search numbers");
      }
      
      const data = await response.json();
      
      setFormData((prev) => ({
        ...prev,
        availableNumbers: data.numbers || [],
        selectedNumber: null,
      }));
      
      if (!data.numbers || data.numbers.length === 0) {
        setSearchError(`No numbers available in area code ${formData.areaCode}. Try a different area code.`);
      }
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : "Failed to search for numbers"
      );
    } finally {
      setIsSearching(false);
    }
  };
  
  // Handle number provisioning
  const handleProvisionNumber = async () => {
    if (!formData.selectedNumber) {
      setProvisionError("Please select a number first");
      return;
    }
    
    setIsProvisioning(true);
    setProvisionError(null);
    
    try {
      const response = await fetch("/api/twilio/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: formData.selectedNumber,
          businessId: state.businessId,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to provision number");
      }
      
      const data = await response.json();
      
      setFormData((prev) => ({
        ...prev,
        twilioSid: data.sid,
        isProvisioned: true,
      }));
    } catch (error) {
      setProvisionError(
        error instanceof Error ? error.message : "Failed to provision number"
      );
    } finally {
      setIsProvisioning(false);
    }
  };
  
  // Handle copy number
  const handleCopyNumber = () => {
    if (formData.selectedNumber) {
      navigator.clipboard.writeText(formatPhoneNumber(formData.selectedNumber));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  // Handle download as contact (vCard)
  const handleDownloadContact = () => {
    if (!formData.selectedNumber) return;
    
    const businessName = "Koya AI Receptionist"; // Could get from context
    const phoneDigits = formData.selectedNumber.replace(/\D/g, "");
    
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${businessName}
TEL;TYPE=WORK,VOICE:+${phoneDigits}
END:VCARD`;
    
    const blob = new Blob([vcard], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "koya-number.vcf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    // Validate based on setup type
    if (formData.setupType === "new" && !formData.isProvisioned) {
      setProvisionError("Please provision a number before continuing");
      return;
    }
    
    if (formData.setupType === "forward" && !formData.forwardingConfirmed) {
      return; // Button should be disabled
    }
    
    setIsSaving(true);
    
    try {
      setStep8Data(formData);
      completeStep(8);
      router.push("/onboarding/test");
    } catch (_error) {
      // Error handled silently
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Loading State */}
      {checkingExisting && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      
      {/* Setup Type Selection */}
      {!checkingExisting && !extendedSetupType && !formData.isProvisioned && (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">How would you like to set up your phone?</h3>
          </div>
          
          {/* Existing Twilio Number Option - Show first if available */}
          {hasExistingNumber && existingNumber && (
            <div
              className="rounded-lg border-2 border-green-500/50 bg-green-500/5 p-6 transition-all cursor-pointer hover:border-green-500"
              onClick={() => handleSetupTypeChange("existing")}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-500/20">
                  <Settings className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">Use your existing Twilio number</h4>
                    <span className="rounded bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-600">
                      Recommended
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Use <span className="font-mono font-semibold">{formatPhoneNumber(existingNumber)}</span> from your Twilio account
                  </p>
                  <p className="mt-1 text-xs text-green-600">
                    No extra cost - uses your existing number
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div
              className="rounded-lg border border-muted p-6 transition-all cursor-pointer hover:border-muted-foreground/50"
              onClick={() => handleSetupTypeChange("new")}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium">Get a new number</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Purchase a new number from Twilio (~$1.15/mo)
                  </p>
                </div>
              </div>
            </div>
            
            <div
              className="rounded-lg border border-muted p-6 transition-all cursor-pointer hover:border-muted-foreground/50"
              onClick={() => handleSetupTypeChange("forward")}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <PhoneForwarded className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h4 className="font-medium">Forward from another number</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Keep your existing business number
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
      
      {/* Configure Existing Twilio Number */}
      {extendedSetupType === "existing" && !formData.isProvisioned && existingNumber && (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Configure Your Twilio Number</h3>
            <p className="text-sm text-muted-foreground">
              We&apos;ll set up webhooks so Koya can answer calls to this number
            </p>
          </div>
          
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-6 text-center">
            <Phone className="mx-auto h-12 w-12 text-green-600" />
            <p className="mt-4 font-mono text-2xl font-bold">
              {formatPhoneNumber(existingNumber)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              From your Twilio account
            </p>
          </div>
          
          <Button
            onClick={handleUseExistingNumber}
            disabled={isConfiguring}
            className="w-full"
            size="lg"
          >
            {isConfiguring ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Configuring...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Use This Number
              </>
            )}
          </Button>
          
          {configureError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{configureError}</AlertDescription>
            </Alert>
          )}
          
          <Button
            variant="ghost"
            onClick={() => setExtendedSetupType(null)}
            className="w-full"
          >
            ← Choose a different option
          </Button>
        </section>
      )}
      
      {/* Area Code Search (for new/forward options) */}
      {extendedSetupType && extendedSetupType !== "existing" && formData.setupType && !formData.isProvisioned && (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Choose Your Koya Number</h3>
            <p className="text-sm text-muted-foreground">
              Enter your preferred area code to see available numbers
            </p>
          </div>
          
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="areaCode" className="sr-only">Area Code</Label>
              <Input
                id="areaCode"
                value={formData.areaCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 3);
                  setFormData((prev) => ({ ...prev, areaCode: value }));
                  setSearchError(null);
                }}
                placeholder="Enter area code (e.g., 415)"
                maxLength={3}
              />
            </div>
            <Button
              onClick={handleSearchNumbers}
              disabled={isSearching || formData.areaCode.length !== 3}
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2">Search</span>
            </Button>
          </div>
          
          {searchError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{searchError}</AlertDescription>
            </Alert>
          )}
          
          {/* Available Numbers */}
          {formData.availableNumbers.length > 0 && (
            <div className="space-y-3">
              <Label>Select a number</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {formData.availableNumbers.map((num) => (
                  <div
                    key={num.phoneNumber}
                    className={`rounded-lg border p-4 transition-all cursor-pointer ${
                      formData.selectedNumber === num.phoneNumber
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-muted hover:border-muted-foreground/50"
                    }`}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        selectedNumber: num.phoneNumber,
                      }))
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-mono text-lg font-medium">
                          {num.friendlyName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {num.locality}, {num.region}
                        </p>
                      </div>
                      {formData.selectedNumber === num.phoneNumber && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Provision Button */}
              <Button
                onClick={handleProvisionNumber}
                disabled={!formData.selectedNumber || isProvisioning}
                className="w-full"
              >
                {isProvisioning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Provisioning...
                  </>
                ) : (
                  <>
                    <Phone className="mr-2 h-4 w-4" />
                    Get This Number
                  </>
                )}
              </Button>
              
              {provisionError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{provisionError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </section>
      )}
      
      {/* Number Provisioned - New Number Flow */}
      {formData.isProvisioned && formData.setupType === "new" && (
        <section className="space-y-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-6 text-center">
            <Phone className="mx-auto h-12 w-12 text-primary" />
            <h3 className="mt-4 text-lg font-semibold">Your Koya Number</h3>
            <p className="mt-2 font-mono text-2xl font-bold">
              {formatPhoneNumber(formData.selectedNumber!)}
            </p>
            
            <div className="mt-4 flex justify-center gap-3">
              <Button variant="outline" size="sm" onClick={handleCopyNumber}>
                {copied ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {copied ? "Copied!" : "Copy Number"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadContact}>
                <Download className="mr-2 h-4 w-4" />
                Download as Contact
              </Button>
            </div>
            
            <div className="mt-6 text-left">
              <p className="font-medium">This is your new business number! Add it to:</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>• Your website</li>
                <li>• Google Business listing</li>
                <li>• Business cards and marketing materials</li>
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">
                All calls to this number go directly to Koya.
              </p>
            </div>
          </div>
        </section>
      )}
      
      {/* Number Provisioned - Forward Flow */}
      {formData.isProvisioned && formData.setupType === "forward" && (
        <section className="space-y-4">
          <div className="rounded-lg border border-accent/20 bg-accent/5 p-6">
            <div className="text-center">
              <PhoneForwarded className="mx-auto h-12 w-12 text-accent" />
              <h3 className="mt-4 text-lg font-semibold">Your Koya Number</h3>
              <p className="mt-2 font-mono text-2xl font-bold">
                {formatPhoneNumber(formData.selectedNumber!)}
              </p>
            </div>
            
            <p className="mt-4 text-center text-sm text-muted-foreground">
              To have Koya answer your existing business line, set up call forwarding
              from your current number to your Koya number.
            </p>
          </div>
          
          {/* Provider Selection */}
          <div className="space-y-3">
            <Label htmlFor="carrier">What&apos;s your phone provider?</Label>
            <Select
              value={formData.carrier || ""}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  carrier: value as PhoneProvider,
                  forwardingConfirmed: false,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {PHONE_PROVIDER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Carrier Instructions */}
          {carrierInstructions && (
            <div className="rounded-lg border bg-card p-6 space-y-4">
              <h4 className="font-medium">
                Setting up call forwarding with {carrierInstructions.name}:
              </h4>
              
              <ol className="space-y-2 text-sm">
                {carrierInstructions.enableSteps.map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              
              {formData.carrier !== "voip" && formData.carrier !== "other" && (
                <div className="rounded-md bg-muted/50 p-4 font-mono text-center">
                  <p className="text-sm text-muted-foreground">Dial:</p>
                  <p className="mt-1 text-lg font-bold">
                    {formatEnableCode(formData.carrier!, formData.selectedNumber!)}
                  </p>
                </div>
              )}
              
              <div className="border-t pt-4">
                <p className="text-sm font-medium">To disable forwarding later:</p>
                <p className="mt-1 font-mono text-sm">
                  {carrierInstructions.disableCode}
                </p>
              </div>
              
              {carrierInstructions.notes.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium">Notes:</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {carrierInstructions.notes.map((note, index) => (
                      <li key={index}>• {note}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {carrierInstructions.helpUrl && (
                <a
                  href={carrierInstructions.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  View detailed guide
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              
              <div className="border-t pt-4">
                <Button
                  variant={formData.forwardingConfirmed ? "secondary" : "default"}
                  className="w-full"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      forwardingConfirmed: !prev.forwardingConfirmed,
                    }))
                  }
                >
                  {formData.forwardingConfirmed ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Forwarding Confirmed
                    </>
                  ) : (
                    "I've set up forwarding"
                  )}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
      
      {/* Dev Mode Skip Option */}
      {!formData.isProvisioned && (
        <section className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-amber-700 dark:text-amber-400">
                Development Mode
              </h4>
              <p className="mt-1 text-sm text-amber-600 dark:text-amber-300">
                Skip phone setup for testing. In production, you&apos;ll need to configure 
                Twilio credentials to provision phone numbers.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 border-amber-500/50 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
                onClick={() => {
                  // Set a mock phone number for dev mode
                  const mockNumber = "+15551234567";
                  setFormData((prev) => ({
                    ...prev,
                    setupType: "new",
                    selectedNumber: mockNumber,
                    isProvisioned: true,
                    twilioSid: "dev_mode_skip",
                  }));
                }}
              >
                Skip for Development →
              </Button>
            </div>
          </div>
        </section>
      )}
      
      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (extendedSetupType && !formData.isProvisioned) {
              // Go back to setup type selection
              setExtendedSetupType(null);
              setFormData((prev) => ({ ...prev, setupType: null }));
            } else {
              router.push("/onboarding/voice");
            }
          }}
        >
          Back
        </Button>
        
        {formData.isProvisioned && (
          <Button
            onClick={handleSubmit}
            disabled={
              isSaving ||
              (formData.setupType === "forward" && !formData.forwardingConfirmed)
            }
          >
            {isSaving ? "Saving..." : "Continue"}
          </Button>
        )}
      </div>
    </div>
  );
}
