"use client";

/**
 * Phase 2.5: Phone Setup Client
 * Allows users to select a phone number for receiving calls
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProgressPath, KoyaAvatar } from "@/components/onboarding-v2";
import {
  Phone,
  Search,
  Check,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface PhoneNumber {
  phoneNumber: string;
  friendlyName: string;
  locality?: string;
  region?: string;
}

interface PhoneSetupClientProps {
  businessId: string;
  existingPhone: {
    number: string;
    setup_type: string;
  } | null;
}

export function PhoneSetupClient({ businessId, existingPhone }: PhoneSetupClientProps) {
  const router = useRouter();
  const [areaCode, setAreaCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<PhoneNumber[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(
    existingPhone?.number || null
  );
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const searchNumbers = async () => {
    if (!areaCode || areaCode.length !== 3) {
      toast({ title: "Invalid Area Code", description: "Please enter a valid 3-digit area code", variant: "destructive" });
      return;
    }

    setIsSearching(true);
    setAvailableNumbers([]);
    setHasSearched(true);

    try {
      const response = await fetch("/api/twilio/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to search for numbers");
      }

      setAvailableNumbers(data.numbers || []);

      if (data.numbers?.length === 0) {
        toast({ title: "No Numbers Available", description: "No numbers available in that area code. Try a different one.", variant: "info" });
      }
    } catch (error) {
      toast({ title: "Search Failed", description: error instanceof Error ? error.message : "Failed to search for numbers", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleProvisionAndContinue = async () => {
    if (!selectedNumber) {
      toast({ title: "No Selection", description: "Please select a phone number", variant: "destructive" });
      return;
    }

    setIsProvisioning(true);

    try {
      // Provision the number
      const response = await fetch("/api/twilio/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: selectedNumber,
          businessId,
          setupType: "direct",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to provision phone number");
      }

      toast({ title: "Success", description: "Phone number provisioned successfully!", variant: "success" });

      // Navigate to test page
      router.push("/onboarding/test");
    } catch (error) {
      toast({ title: "Provisioning Failed", description: error instanceof Error ? error.message : "Failed to provision phone number", variant: "destructive" });
      setIsProvisioning(false);
    }
  };

  const handleSkip = () => {
    // Allow skipping - user can set up phone later in settings
    router.push("/onboarding/test");
  };

  const formatPhoneNumber = (phone: string): string => {
    // Format +1XXXXXXXXXX as (XXX) XXX-XXXX
    if (phone.startsWith("+1") && phone.length === 12) {
      const digits = phone.substring(2);
      return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
    }
    return phone;
  };

  // If user already has a phone number, show confirmation
  if (existingPhone) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <ProgressPath currentPhase={3} />
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="flex justify-center mb-4">
              <KoyaAvatar state="celebrating" size="lg" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Phone Number Ready</h1>
            <p className="text-muted-foreground">
              You already have a phone number set up
            </p>
          </motion.div>

          <Card className="mb-6">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <Phone className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold mb-2">
                {formatPhoneNumber(existingPhone.number)}
              </p>
              <p className="text-sm text-muted-foreground">
                {existingPhone.setup_type === "forwarded" ? "Forwarded number" : "Direct number"}
              </p>
            </CardContent>
          </Card>

          <Button
            size="lg"
            className="w-full gap-2"
            onClick={() => router.push("/onboarding/test")}
          >
            Continue to Test Call
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Progress bar */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <ProgressPath currentPhase={3} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex justify-center mb-4">
            <KoyaAvatar state="idle" size="lg" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Get Your Phone Number</h1>
          <p className="text-muted-foreground">
            Choose a local phone number for Koya to answer
          </p>
        </motion.div>

        {/* Use existing Twilio number */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6"
        >
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <Phone className="w-5 h-5 text-primary" />
                <p className="font-medium">Already have a Twilio number?</p>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                If you have a Twilio phone number configured in your environment variables, click below to use it.
              </p>
              <Button
                variant="default"
                className="w-full"
                disabled={isProvisioning}
                onClick={async () => {
                  setIsProvisioning(true);
                  try {
                    const res = await fetch("/api/twilio/configure", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ businessId }),
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                      toast({
                        title: "Phone configured",
                        description: `${data.phoneNumber} has been configured successfully.`,
                        variant: "success",
                      });
                      router.push("/onboarding/test");
                    } else {
                      toast({
                        title: "Configuration failed",
                        description: data.message || data.error || "Failed to configure phone number. Make sure TWILIO_PHONE_NUMBER is set in your .env.local",
                        variant: "destructive",
                      });
                    }
                  } catch {
                    toast({
                      title: "Error",
                      description: "Failed to configure phone number",
                      variant: "destructive",
                    });
                  } finally {
                    setIsProvisioning(false);
                  }
                }}
              >
                {isProvisioning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Configuring...
                  </>
                ) : (
                  "Use My Existing Twilio Number"
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or get a new number</span>
          </div>
        </div>

        {/* Area code search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <Card>
            <CardContent className="p-6">
              <label className="block text-sm font-medium mb-2">
                Enter your area code
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="e.g., 415"
                  maxLength={3}
                  value={areaCode}
                  onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && searchNumbers()}
                  className="text-center text-lg font-mono"
                />
                <Button
                  onClick={searchNumbers}
                  disabled={isSearching || areaCode.length !== 3}
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                We&apos;ll find available phone numbers in your area
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Available numbers */}
        {(availableNumbers.length > 0 || hasSearched) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6"
          >
            {availableNumbers.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium mb-3">
                  Available numbers ({availableNumbers.length})
                </p>
                {availableNumbers.map((phone) => (
                  <Card
                    key={phone.phoneNumber}
                    className={`cursor-pointer transition-all ${
                      selectedNumber === phone.phoneNumber
                        ? "border-primary ring-1 ring-primary"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedNumber(phone.phoneNumber)}
                  >
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-mono text-lg">
                          {formatPhoneNumber(phone.phoneNumber)}
                        </p>
                        {phone.locality && (
                          <p className="text-sm text-muted-foreground">
                            {phone.locality}, {phone.region}
                          </p>
                        )}
                      </div>
                      {selectedNumber === phone.phoneNumber && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-orange-500/50 bg-orange-500/5">
                <CardContent className="flex items-center gap-3 p-4">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="font-medium">No numbers available</p>
                    <p className="text-sm text-muted-foreground">
                      Try a different area code or skip for now
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {/* Continue button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <Button
            size="lg"
            className="w-full gap-2"
            disabled={!selectedNumber || isProvisioning}
            onClick={handleProvisionAndContinue}
          >
            {isProvisioning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Setting up your number...
              </>
            ) : (
              <>
                Continue with Selected Number
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>

          <p className="text-center">
            <button
              onClick={handleSkip}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now, set up phone later
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
