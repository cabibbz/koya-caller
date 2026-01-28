"use client";

/**
 * Admin Global Search Client Component
 * Search across all data types
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Loader2,
  Building2,
  Phone,
  Calendar,
  User,
  Clock,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "business" | "call" | "appointment" | "user";
  title: string;
  subtitle: string;
  metadata: Record<string, string>;
  link?: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  business: <Building2 className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  appointment: <Calendar className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
};

const typeColors: Record<string, string> = {
  business: "bg-blue-500/10 text-blue-500",
  call: "bg-emerald-500/10 text-emerald-500",
  appointment: "bg-purple-500/10 text-purple-500",
  user: "bg-amber-500/10 text-amber-500",
};

export function SearchClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const params = new URLSearchParams({ q: query });
      if (typeFilter !== "all") {
        params.append("type", typeFilter);
      }

      const response = await fetch(`/api/admin/search?${params}`);
      if (!response.ok) throw new Error("Search failed");

      const data = await response.json();
      setResults(data.results || []);
    } catch (_err) {
      // Error handled silently
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, typeFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        handleSearch();
      } else {
        setResults([]);
        setSearched(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, typeFilter, handleSearch]);

  const filteredResults = results.filter(
    (r) => typeFilter === "all" || r.type === typeFilter
  );

  const resultCounts = {
    all: results.length,
    business: results.filter((r) => r.type === "business").length,
    call: results.filter((r) => r.type === "call").length,
    appointment: results.filter((r) => r.type === "appointment").length,
    user: results.filter((r) => r.type === "user").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Global Search</h1>
        <p className="text-muted-foreground">
          Search across businesses, calls, appointments, and users
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, phone number, or ID..."
          className="pl-12 h-12 text-lg"
          autoFocus
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Type Filters */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "business", "call", "appointment", "user"] as const).map((type) => (
          <Button
            key={type}
            variant={typeFilter === type ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter(type)}
            className="gap-2"
          >
            {type !== "all" && typeIcons[type]}
            <span className="capitalize">{type === "all" ? "All Results" : `${type}s`}</span>
            {searched && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-background/50">
                {resultCounts[type]}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-2">
        {!searched && query.length < 2 && (
          <div className="p-12 text-center text-muted-foreground border border-dashed border-border rounded-lg">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Enter at least 2 characters to search</p>
          </div>
        )}

        {searched && filteredResults.length === 0 && !loading && (
          <div className="p-12 text-center text-muted-foreground border border-border rounded-lg">
            <p>No results found for &quot;{query}&quot;</p>
            <p className="text-sm mt-1">Try a different search term or filter</p>
          </div>
        )}

        {filteredResults.map((result) => (
          <div
            key={`${result.type}-${result.id}`}
            className="p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    typeColors[result.type]
                  )}
                >
                  {typeIcons[result.type]}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium">{result.title}</span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-xs capitalize",
                        typeColors[result.type]
                      )}
                    >
                      {result.type}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{result.subtitle}</p>
                  {Object.keys(result.metadata).length > 0 && (
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {Object.entries(result.metadata).map(([key, value]) => (
                        <span key={key} className="flex items-center gap-1">
                          {key === "date" && <Clock className="h-3 w-3" />}
                          {value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {result.link && (
                <Button variant="ghost" size="icon" asChild>
                  <a href={result.link}>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Search Tips */}
      {!searched && (
        <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <h4 className="font-medium mb-2">Search Tips</h4>
          <ul className="space-y-1">
            <li>Search by business name: Joe&apos;s Plumbing</li>
            <li>Search by email: john@example.com</li>
            <li>Search by phone: +1 555 123 4567</li>
            <li>Search by call ID or appointment ID</li>
          </ul>
        </div>
      )}
    </div>
  );
}
