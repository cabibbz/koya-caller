"use client";

/**
 * Service Availability Component
 * Per-service availability overrides
 */

import { useState, useEffect } from "react";
import {
  Settings2,
  Loader2,
  Save,
  Clock,
  Building2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Label,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Alert,
  AlertDescription,
  Badge,
} from "@/components/ui";
import { toast } from "@/hooks/use-toast";
import type { Service, ServiceAvailability as ServiceAvailabilityType } from "@/types";

// ============================================
// Types
// ============================================

interface ServiceWithAvailability {
  service: Service;
  availability: ServiceAvailabilityType[];
  usesBusinessHours: boolean;
}

interface DayAvailability {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
  use_business_hours: boolean;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

// Generate time options in 30-minute increments
const generateTimeOptions = () => {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour.toString().padStart(2, "0");
      const m = minute.toString().padStart(2, "0");
      options.push(`${h}:${m}`);
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

const DEFAULT_AVAILABILITY: DayAvailability[] = DAYS_OF_WEEK.map((day) => ({
  day_of_week: day.value,
  open_time: day.value === 0 || day.value === 6 ? null : "09:00",
  close_time: day.value === 0 || day.value === 6 ? null : "17:00",
  is_closed: day.value === 0 || day.value === 6,
  use_business_hours: false,
}));

// ============================================
// Helper Functions
// ============================================

const formatTime = (time: string | null) => {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

// ============================================
// Component
// ============================================

export function ServiceAvailability() {
  const [services, setServices] = useState<ServiceWithAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [editingAvailability, setEditingAvailability] = useState<
    Map<string, DayAvailability[]>
  >(new Map());
  const [savingService, setSavingService] = useState<string | null>(null);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchServices = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "/api/dashboard/settings/availability/services"
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch services");
      }

      setServices(data.data || []);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to load services",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // ============================================
  // Actions
  // ============================================

  const toggleExpand = (serviceId: string) => {
    if (expandedService === serviceId) {
      setExpandedService(null);
      setEditingAvailability((prev) => {
        const newMap = new Map(prev);
        newMap.delete(serviceId);
        return newMap;
      });
    } else {
      setExpandedService(serviceId);
      // Initialize editing state
      const service = services.find((s) => s.service.id === serviceId);
      if (service) {
        const availability: DayAvailability[] =
          service.availability.length > 0
            ? service.availability.map((a) => ({
                day_of_week: a.day_of_week,
                open_time: a.open_time,
                close_time: a.close_time,
                is_closed: a.is_closed,
                use_business_hours: a.use_business_hours,
              }))
            : DEFAULT_AVAILABILITY;

        setEditingAvailability((prev) => {
          const newMap = new Map(prev);
          newMap.set(serviceId, availability);
          return newMap;
        });
      }
    }
  };

  const handleToggleUseBusinessHours = async (
    serviceId: string,
    useBusinessHours: boolean
  ) => {
    setSavingService(serviceId);
    try {
      const response = await fetch(
        "/api/dashboard/settings/availability/services",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId,
            useBusinessHours,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update service");
      }

      // Update local state
      setServices((prev) =>
        prev.map((s) =>
          s.service.id === serviceId
            ? {
                ...s,
                availability: data.data.availability,
                usesBusinessHours: data.data.usesBusinessHours,
              }
            : s
        )
      );

      // Close expanded section if switching to business hours
      if (useBusinessHours) {
        setExpandedService(null);
      }

      toast({
        title: "Updated",
        description: useBusinessHours
          ? "Service now uses business hours"
          : "Service has custom availability",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update service",
        variant: "destructive",
      });
    } finally {
      setSavingService(null);
    }
  };

  const updateDayAvailability = (
    serviceId: string,
    dayOfWeek: number,
    updates: Partial<DayAvailability>
  ) => {
    setEditingAvailability((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(serviceId) || DEFAULT_AVAILABILITY;
      const updated = current.map((day) =>
        day.day_of_week === dayOfWeek ? { ...day, ...updates } : day
      );
      newMap.set(serviceId, updated);
      return newMap;
    });
  };

  const handleSaveCustomAvailability = async (serviceId: string) => {
    const availability = editingAvailability.get(serviceId);
    if (!availability) return;

    setSavingService(serviceId);
    try {
      const response = await fetch(
        "/api/dashboard/settings/availability/services",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId,
            useBusinessHours: false,
            availability,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update service");
      }

      // Update local state
      setServices((prev) =>
        prev.map((s) =>
          s.service.id === serviceId
            ? {
                ...s,
                availability: data.data.availability,
                usesBusinessHours: false,
              }
            : s
        )
      );

      toast({
        title: "Saved",
        description: "Custom availability has been saved",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save availability",
        variant: "destructive",
      });
    } finally {
      setSavingService(null);
    }
  };

  // ============================================
  // Render
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Service Availability
          </CardTitle>
          <CardDescription>
            Override business hours for specific services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              By default, services use your business hours. You can set custom
              availability for services that have different schedules.
            </AlertDescription>
          </Alert>

          {/* Services List */}
          {services.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No services configured</p>
              <p className="text-sm">Add services in the Knowledge section first</p>
            </div>
          ) : (
            <div className="space-y-4">
              {services.map(({ service, usesBusinessHours }) => {
                const isExpanded = expandedService === service.id;
                const availability = editingAvailability.get(service.id);
                const isSaving = savingService === service.id;

                return (
                  <div key={service.id} className="border rounded-lg">
                    {/* Service Header */}
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium">{service.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {service.duration_minutes} min
                            {service.price_cents && service.price_type === "fixed"
                              ? ` - $${(service.price_cents / 100).toFixed(2)}`
                              : ""}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Use Business Hours Toggle */}
                        <div className="flex items-center gap-2">
                          <Label className="text-sm flex items-center gap-1">
                            <Building2 className="h-4 w-4" />
                            Use Business Hours
                          </Label>
                          <Switch
                            checked={usesBusinessHours}
                            onCheckedChange={(checked) =>
                              handleToggleUseBusinessHours(service.id, checked)
                            }
                            disabled={isSaving}
                          />
                        </div>

                        {/* Badge */}
                        {usesBusinessHours ? (
                          <Badge variant="secondary">
                            <Building2 className="h-3 w-3 mr-1" />
                            Business Hours
                          </Badge>
                        ) : (
                          <Badge variant="default">
                            <Clock className="h-3 w-3 mr-1" />
                            Custom
                          </Badge>
                        )}

                        {/* Expand Button (only for custom) */}
                        {!usesBusinessHours && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(service.id)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded Custom Availability */}
                    {isExpanded && !usesBusinessHours && availability && (
                      <div className="border-t p-4 bg-muted/30">
                        <div className="space-y-3">
                          {DAYS_OF_WEEK.map((dayInfo) => {
                            const day = availability.find(
                              (a) => a.day_of_week === dayInfo.value
                            );
                            if (!day) return null;

                            return (
                              <div
                                key={dayInfo.value}
                                className="flex items-center gap-4 p-3 bg-background border rounded"
                              >
                                {/* Day Name */}
                                <div className="w-24 font-medium text-sm">
                                  {dayInfo.label}
                                </div>

                                {/* Open/Closed Toggle */}
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={!day.is_closed}
                                    onCheckedChange={(checked) =>
                                      updateDayAvailability(
                                        service.id,
                                        day.day_of_week,
                                        {
                                          is_closed: !checked,
                                          open_time: checked ? "09:00" : null,
                                          close_time: checked ? "17:00" : null,
                                        }
                                      )
                                    }
                                  />
                                  <span className="text-xs w-12">
                                    {day.is_closed ? "Closed" : "Open"}
                                  </span>
                                </div>

                                {/* Time Selectors */}
                                {!day.is_closed && (
                                  <div className="flex items-center gap-2 flex-1">
                                    <Select
                                      value={day.open_time || "09:00"}
                                      onValueChange={(value) =>
                                        updateDayAvailability(
                                          service.id,
                                          day.day_of_week,
                                          { open_time: value }
                                        )
                                      }
                                    >
                                      <SelectTrigger className="w-28 h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {TIME_OPTIONS.map((time) => (
                                          <SelectItem key={time} value={time}>
                                            {formatTime(time)}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>

                                    <span className="text-xs text-muted-foreground">
                                      to
                                    </span>

                                    <Select
                                      value={day.close_time || "17:00"}
                                      onValueChange={(value) =>
                                        updateDayAvailability(
                                          service.id,
                                          day.day_of_week,
                                          { close_time: value }
                                        )
                                      }
                                    >
                                      <SelectTrigger className="w-28 h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {TIME_OPTIONS.filter(
                                          (time) =>
                                            time > (day.open_time || "00:00")
                                        ).map((time) => (
                                          <SelectItem key={time} value={time}>
                                            {formatTime(time)}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {day.is_closed && (
                                  <div className="flex-1 text-xs text-muted-foreground">
                                    Not available
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end mt-4">
                          <Button
                            onClick={() =>
                              handleSaveCustomAvailability(service.id)
                            }
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            Save Custom Hours
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
