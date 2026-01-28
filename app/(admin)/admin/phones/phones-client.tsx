"use client";

/**
 * Admin Phone Numbers Client Component
 * View all Twilio phone numbers and their assignments
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Phone,
  Search,
  RefreshCw,
  AlertCircle,
  Loader2,
  CheckCircle,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PhoneNumber {
  id: string;
  phone_number: string;
  friendly_name: string;
  business_id: string | null;
  business_name: string | null;
  status: "active" | "available" | "error";
  capabilities: {
    voice: boolean;
    sms: boolean;
  };
  created_at: string;
  last_call_at: string | null;
  total_calls: number;
}

interface PhoneStats {
  total_numbers: number;
  assigned_numbers: number;
  available_numbers: number;
  total_calls_today: number;
}

export function PhonesClient() {
  const [phones, setPhones] = useState<PhoneNumber[]>([]);
  const [stats, setStats] = useState<PhoneStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "assigned" | "available">("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/phones");
      if (!response.ok) throw new Error("Failed to fetch phone numbers");

      const data = await response.json();
      setPhones(data.phones || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const filteredPhones = phones.filter((p) => {
    const matchesSearch =
      p.phone_number.includes(searchQuery) ||
      p.friendly_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.business_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filter === "all" ||
      (filter === "assigned" && p.business_id) ||
      (filter === "available" && !p.business_id);

    return matchesSearch && matchesFilter;
  });

  const formatPhoneNumber = (phone: string) => {
    // Format as (XXX) XXX-XXXX
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Phone Numbers</h1>
          <p className="text-muted-foreground">Manage Twilio phone number inventory</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Phone className="h-4 w-4" />
              <span className="text-sm">Total Numbers</span>
            </div>
            <p className="text-2xl font-bold">{stats.total_numbers}</p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-emerald-500 mb-2">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Assigned</span>
            </div>
            <p className="text-2xl font-bold">{stats.assigned_numbers}</p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-blue-500 mb-2">
              <Phone className="h-4 w-4" />
              <span className="text-sm">Available</span>
            </div>
            <p className="text-2xl font-bold">{stats.available_numbers}</p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Phone className="h-4 w-4" />
              <span className="text-sm">Calls Today</span>
            </div>
            <p className="text-2xl font-bold">{stats.total_calls_today}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by number or business..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "assigned", "available"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Phone Numbers Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 text-sm font-medium">Phone Number</th>
                <th className="text-left p-4 text-sm font-medium">Status</th>
                <th className="text-left p-4 text-sm font-medium">Assigned To</th>
                <th className="text-left p-4 text-sm font-medium">Capabilities</th>
                <th className="text-left p-4 text-sm font-medium">Total Calls</th>
                <th className="text-left p-4 text-sm font-medium">Last Call</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredPhones.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No phone numbers found
                  </td>
                </tr>
              ) : (
                filteredPhones.map((phone) => (
                  <tr key={phone.id} className="hover:bg-muted/30">
                    <td className="p-4">
                      <div>
                        <p className="font-mono font-medium">{formatPhoneNumber(phone.phone_number)}</p>
                        {phone.friendly_name && (
                          <p className="text-sm text-muted-foreground">{phone.friendly_name}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                          phone.business_id
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-blue-500/10 text-blue-500"
                        )}
                      >
                        {phone.business_id ? (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            Assigned
                          </>
                        ) : (
                          <>
                            <Phone className="h-3 w-3" />
                            Available
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-4">
                      {phone.business_name ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{phone.business_name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {phone.capabilities?.voice && (
                          <span className="px-2 py-0.5 rounded text-xs bg-muted">Voice</span>
                        )}
                        {phone.capabilities?.sms && (
                          <span className="px-2 py-0.5 rounded text-xs bg-muted">SMS</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-medium">{phone.total_calls || 0}</span>
                    </td>
                    <td className="p-4">
                      {phone.last_call_at ? (
                        <span className="text-sm text-muted-foreground">
                          {new Date(phone.last_call_at).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
