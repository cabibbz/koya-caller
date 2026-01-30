"use client";

/**
 * Call Filters Component
 * Handles date range, outcome, language, and search filtering for calls list
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

export interface CallFiltersValues {
  startDate?: string;
  endDate?: string;
  outcome?: string;
  language?: string;
  search?: string;
}

export interface CallFiltersProps {
  filters: CallFiltersValues;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearch: () => void;
  onFilterChange: (key: string, value: string | undefined) => void;
  onClearFilters: () => void;
}

export function CallFilters({
  filters,
  searchQuery,
  onSearchQueryChange,
  onSearch,
  onFilterChange,
  onClearFilters,
}: CallFiltersProps) {
  const t = useTranslations("calls");
  const tCommon = useTranslations("common");

  const hasActiveFilters =
    filters.outcome ||
    filters.language ||
    filters.search ||
    filters.startDate ||
    filters.endDate;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div className="sm:col-span-2">
            <Label className="text-xs text-muted-foreground">
              {tCommon("search")}
            </Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                placeholder={`${tCommon("search")}...`}
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                className="flex-1"
              />
              <Button variant="secondary" size="icon" onClick={onSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Outcome filter */}
          <div>
            <Label className="text-xs text-muted-foreground">
              {t("outcome")}
            </Label>
            <Select
              value={filters.outcome || "all"}
              onValueChange={(v) =>
                onFilterChange("outcome", v === "all" ? undefined : v)
              }
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={t("allOutcomes")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allOutcomes")}</SelectItem>
                <SelectItem value="booked">{t("booked")}</SelectItem>
                <SelectItem value="transferred">{t("transferred")}</SelectItem>
                <SelectItem value="info">{t("infoOnly")}</SelectItem>
                <SelectItem value="message">{t("message")}</SelectItem>
                <SelectItem value="missed">{t("missed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Language filter */}
          <div>
            <Label className="text-xs text-muted-foreground">
              {t("language")}
            </Label>
            <Select
              value={filters.language || "all"}
              onValueChange={(v) =>
                onFilterChange("language", v === "all" ? undefined : v)
              }
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={t("allLanguages")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allLanguages")}</SelectItem>
                <SelectItem value="en">{t("english")}</SelectItem>
                <SelectItem value="es">{t("spanish")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date Range Filters */}
        <div className="grid gap-4 sm:grid-cols-2 mt-4 pt-4 border-t">
          <div>
            <DatePicker
              label="From Date"
              value={filters.startDate || ""}
              onChange={(e) =>
                onFilterChange("startDate", e.target.value || undefined)
              }
            />
          </div>
          <div>
            <DatePicker
              label="To Date"
              value={filters.endDate || ""}
              onChange={(e) =>
                onFilterChange("endDate", e.target.value || undefined)
              }
            />
          </div>
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <div className="mt-4 pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              {t("clearFilters")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export interface CallFiltersToggleProps {
  showFilters: boolean;
  onToggle: () => void;
  hasActiveFilters: boolean;
}

export function CallFiltersToggle({
  showFilters,
  onToggle,
  hasActiveFilters,
}: CallFiltersToggleProps) {
  const tCommon = useTranslations("common");

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 w-fit"
      onClick={onToggle}
    >
      <Search className="h-4 w-4" />
      {tCommon("filter")}
      {hasActiveFilters && (
        <Badge variant="secondary" className="ml-1">
          Active
        </Badge>
      )}
    </Button>
  );
}
