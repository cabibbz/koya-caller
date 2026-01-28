"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calendar,
  Clock,
  CheckCircle,
  ArrowLeft,
  Loader2,
  User,
  Phone,
  Mail,
} from "lucide-react";

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  description: string | null;
}

interface BusinessInfo {
  name: string;
  slug: string;
  timezone: string;
}

interface TimeSlot {
  startTime: number;
  endTime: number;
}

interface BookingPageProps {
  slug: string;
}

type Step = "service" | "datetime" | "details" | "confirmation";

export function BookingPage({ slug }: BookingPageProps) {
  const [step, setStep] = useState<Step>("service");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Selections
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Customer details
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Result
  const [bookingResult, setBookingResult] = useState<{
    serviceName: string;
    start: string;
    end: string;
    customerName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch business info on mount
  useEffect(() => {
    async function fetchBusiness() {
      try {
        const res = await fetch(`/api/public/book?slug=${encodeURIComponent(slug)}`);
        if (!res.ok) throw new Error("Business not found");
        const data = await res.json();
        setBusiness(data.business);
        setServices(data.services);
      } catch {
        setError("This booking page is not available.");
      } finally {
        setLoading(false);
      }
    }
    fetchBusiness();
  }, [slug]);

  // Fetch time slots when date changes
  const fetchSlots = useCallback(async (date: string) => {
    if (!selectedService) return;
    setLoadingSlots(true);
    setTimeSlots([]);
    try {
      const params = new URLSearchParams({
        slug,
        date,
        serviceId: selectedService.id,
      });
      const res = await fetch(`/api/public/book?${params}`);
      const data = await res.json();
      setTimeSlots(data.timeSlots || []);
    } catch {
      setTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [slug, selectedService]);

  useEffect(() => {
    if (selectedDate && selectedService) {
      fetchSlots(selectedDate);
    }
  }, [selectedDate, selectedService, fetchSlots]);

  // Generate next 14 days for date picker
  const availableDates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split("T")[0];
  });

  const formatTime = (unix: number) => {
    return new Date(unix * 1000).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const handleSubmit = async () => {
    if (!selectedService || !selectedSlot) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/public/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          serviceId: selectedService.id,
          startTime: selectedSlot.startTime,
          customerName,
          customerPhone,
          customerEmail: customerEmail || undefined,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to book appointment");
      }

      setBookingResult(data.appointment);
      setStep("confirmation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !business) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="text-center">{business?.name}</CardTitle>
          <p className="text-center text-sm text-muted-foreground">Book an appointment</p>

          {/* Step indicator */}
          <div className="flex justify-center gap-2 pt-2">
            {(["service", "datetime", "details"] as Step[]).map((s, i) => (
              <div
                key={s}
                className={`h-1.5 w-12 rounded-full transition-colors ${
                  step === s || (step === "confirmation" && i < 3)
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {error && step !== "confirmation" && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Select Service */}
          {step === "service" && (
            <div className="space-y-3">
              <h3 className="font-medium">Select a service</h3>
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground">No services available for booking.</p>
              ) : (
                services.map((service) => (
                  <div
                    key={service.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedService?.id === service.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:border-muted-foreground/50"
                    }`}
                    onClick={() => setSelectedService(service)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{service.name}</h4>
                        {service.description && (
                          <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {service.duration_minutes} min
                        </p>
                      </div>
                      {service.price != null && service.price > 0 && (
                        <span className="font-medium">${service.price}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
              <Button
                className="w-full mt-4"
                disabled={!selectedService}
                onClick={() => setStep("datetime")}
              >
                Continue
              </Button>
            </div>
          )}

          {/* Step 2: Select Date & Time */}
          {step === "datetime" && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("service")}
                className="mb-2"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>

              <h3 className="font-medium">
                <Calendar className="w-4 h-4 inline mr-2" />
                Select a date
              </h3>

              <div className="grid grid-cols-3 gap-2">
                {availableDates.map((date) => (
                  <Button
                    key={date}
                    variant={selectedDate === date ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedDate(date);
                      setSelectedSlot(null);
                    }}
                    className="text-xs"
                  >
                    {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </Button>
                ))}
              </div>

              {selectedDate && (
                <>
                  <h3 className="font-medium pt-2">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Available times
                  </h3>

                  {loadingSlots ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  ) : timeSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      No available times on this date.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlots.map((slot) => (
                        <Button
                          key={slot.startTime}
                          variant={selectedSlot?.startTime === slot.startTime ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedSlot(slot)}
                        >
                          {formatTime(slot.startTime)}
                        </Button>
                      ))}
                    </div>
                  )}
                </>
              )}

              <Button
                className="w-full mt-4"
                disabled={!selectedSlot}
                onClick={() => setStep("details")}
              >
                Continue
              </Button>
            </div>
          )}

          {/* Step 3: Customer Details */}
          {step === "details" && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("datetime")}
                className="mb-2"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>

              {/* Summary */}
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <p className="font-medium">{selectedService?.name}</p>
                <p>{selectedDate && formatDate(selectedDate)}</p>
                <p>{selectedSlot && formatTime(selectedSlot.startTime)}</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    <User className="w-3 h-3 inline mr-1" /> Name *
                  </Label>
                  <Input
                    id="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">
                    <Phone className="w-3 h-3 inline mr-1" /> Phone *
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="(555) 555-5555"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">
                    <Mail className="w-3 h-3 inline mr-1" /> Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything you'd like us to know"
                    rows={2}
                  />
                </div>
              </div>

              <Button
                className="w-full"
                disabled={!customerName || !customerPhone || !customerEmail || submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                {submitting ? "Booking..." : "Confirm Booking"}
              </Button>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {step === "confirmation" && bookingResult && (
            <div className="text-center space-y-4 py-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <h3 className="text-lg font-medium">Booking Confirmed!</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">{bookingResult.serviceName}</p>
                <p>
                  {new Date(bookingResult.start).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <p>
                  {new Date(bookingResult.start).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                You&apos;ll receive a confirmation shortly.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
