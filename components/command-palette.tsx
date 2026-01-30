"use client";

/**
 * Command Palette Component
 * Global search triggered by Cmd+K / Ctrl+K
 * Searches across calls, appointments, contacts, and pages
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Search,
  Phone,
  Calendar,
  User,
  HelpCircle,
  Home,
  Settings,
  BarChart3,
  CreditCard,
  BookOpen,
  X,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Loader2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

interface SearchResult {
  id: string;
  type: "call" | "appointment" | "contact" | "faq" | "page";
  title: string;
  subtitle: string;
  href: string;
  icon: string;
  timestamp?: string;
}

interface GroupedResults {
  calls: SearchResult[];
  appointments: SearchResult[];
  contacts: SearchResult[];
  faqs: SearchResult[];
  pages: SearchResult[];
}

interface SearchResponse {
  success: boolean;
  data: {
    query: string;
    results: GroupedResults;
    totalCount: number;
  };
}

// =============================================================================
// Constants
// =============================================================================

const RECENT_SEARCHES_KEY = "koya-recent-searches";
const MAX_RECENT_SEARCHES = 5;
const DEBOUNCE_MS = 200;

const RESULT_CATEGORIES: { key: keyof GroupedResults; label: string }[] = [
  { key: "pages", label: "Pages" },
  { key: "calls", label: "Calls" },
  { key: "appointments", label: "Appointments" },
  { key: "contacts", label: "Contacts" },
  { key: "faqs", label: "Knowledge" },
];

// =============================================================================
// Icon Map
// =============================================================================

function getIcon(iconName: string) {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    "phone-incoming": Phone,
    phone: Phone,
    calendar: Calendar,
    user: User,
    "help-circle": HelpCircle,
    home: Home,
    settings: Settings,
    chart: BarChart3,
    "credit-card": CreditCard,
    book: BookOpen,
  };
  return icons[iconName] || HelpCircle;
}

// =============================================================================
// Recent Searches
// =============================================================================

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string): void {
  if (typeof window === "undefined" || !query.trim()) return;
  try {
    const recent = getRecentSearches().filter((q) => q !== query);
    recent.unshift(query);
    localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(recent.slice(0, MAX_RECENT_SEARCHES))
    );
  } catch {
    // Ignore localStorage errors
  }
}

// =============================================================================
// Component
// =============================================================================

export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GroupedResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Flatten results for keyboard navigation (memoized to prevent dependency changes)
  const flattenedResults: SearchResult[] = React.useMemo(
    () =>
      results
        ? [
            ...results.pages,
            ...results.calls,
            ...results.appointments,
            ...results.contacts,
            ...results.faqs,
          ]
        : [],
    [results]
  );

  // =============================================================================
  // Effects
  // =============================================================================

  // Handle mounting for portal
  useEffect(() => {
    setMounted(true);
    setRecentSearches(getRecentSearches());
  }, []);

  // Keyboard shortcut to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K / Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      // Escape to close
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setResults(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/dashboard/search?q=${encodeURIComponent(query)}&limit=5`
        );
        const data: SearchResponse = await response.json();

        if (data.success) {
          setResults(data.data.results);
          setSelectedIndex(0);
        }
      } catch {
        // Silently fail - search results will remain empty
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && flattenedResults.length > 0) {
      const selectedElement = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, flattenedResults.length]);

  // =============================================================================
  // Handlers
  // =============================================================================

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      if (query.trim()) {
        saveRecentSearch(query);
      }
      handleClose();
      router.push(result.href);
    },
    [query, router, handleClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const totalResults = flattenedResults.length;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % Math.max(totalResults, 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev === 0 ? Math.max(totalResults - 1, 0) : prev - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (flattenedResults[selectedIndex]) {
            handleSelect(flattenedResults[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          handleClose();
          break;
      }
    },
    [flattenedResults, selectedIndex, handleSelect, handleClose]
  );

  const handleRecentClick = useCallback((recentQuery: string) => {
    setQuery(recentQuery);
  }, []);

  // =============================================================================
  // Render
  // =============================================================================

  if (!mounted) return null;

  const content = (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center pt-[15vh] transition-opacity duration-200",
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className={cn(
          "relative w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden transform transition-all duration-200",
          isOpen ? "scale-100 translate-y-0" : "scale-95 -translate-y-4"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search calls, appointments, contacts, pages..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
            aria-label="Search"
            aria-autocomplete="list"
            aria-controls="command-palette-results"
            aria-activedescendant={
              flattenedResults[selectedIndex]
                ? `result-${flattenedResults[selectedIndex].id}`
                : undefined
            }
          />
          {isLoading && (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          )}
          <button
            onClick={handleClose}
            className="p-1 hover:bg-muted rounded transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="command-palette-results"
          className="max-h-[60vh] overflow-y-auto"
          role="listbox"
        >
          {/* Empty state with recent searches */}
          {!query && recentSearches.length > 0 && (
            <div className="p-2">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Recent Searches
              </div>
              {recentSearches.map((recentQuery) => (
                <button
                  key={recentQuery}
                  onClick={() => handleRecentClick(recentQuery)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-muted rounded-lg transition-colors"
                >
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{recentQuery}</span>
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {query && !isLoading && flattenedResults.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No results found for &quot;{query}&quot;</p>
              <p className="text-xs mt-1">Try searching for calls, appointments, or pages</p>
            </div>
          )}

          {/* Grouped Results */}
          {results && flattenedResults.length > 0 && (
            <div className="p-2">
              {RESULT_CATEGORIES.map(({ key, label }) => {
                const categoryResults = results[key];
                if (!categoryResults || categoryResults.length === 0)
                  return null;

                // Calculate starting index for this category
                let startIndex = 0;
                for (const cat of RESULT_CATEGORIES) {
                  if (cat.key === key) break;
                  startIndex += results[cat.key]?.length || 0;
                }

                return (
                  <div key={key} className="mb-2">
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {label}
                    </div>
                    {categoryResults.map((result, idx) => {
                      const globalIndex = startIndex + idx;
                      const Icon = getIcon(result.icon);
                      const isSelected = selectedIndex === globalIndex;

                      return (
                        <button
                          key={result.id}
                          id={`result-${result.id}`}
                          data-index={globalIndex}
                          onClick={() => handleSelect(result)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          )}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4 flex-shrink-0",
                              isSelected
                                ? "text-primary-foreground"
                                : "text-muted-foreground"
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div
                              className={cn(
                                "text-sm font-medium truncate",
                                isSelected
                                  ? "text-primary-foreground"
                                  : "text-foreground"
                              )}
                            >
                              {result.title}
                            </div>
                            <div
                              className={cn(
                                "text-xs truncate",
                                isSelected
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground"
                              )}
                            >
                              {result.subtitle}
                            </div>
                          </div>
                          {result.type !== "page" && (
                            <span
                              className={cn(
                                "text-[10px] font-medium px-1.5 py-0.5 rounded capitalize",
                                isSelected
                                  ? "bg-primary-foreground/20 text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {result.type}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/50 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">
                <ArrowUp className="h-3 w-3 inline" />
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">
                <ArrowDown className="h-3 w-3 inline" />
              </kbd>
              <span className="ml-1">Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">
                <CornerDownLeft className="h-3 w-3 inline" />
              </kbd>
              <span className="ml-1">Select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">
                esc
              </kbd>
              <span className="ml-1">Close</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// =============================================================================
// Trigger Button (for header)
// =============================================================================

export function CommandPaletteTrigger({ className }: { className?: string }) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

  const handleClick = () => {
    // Dispatch keyboard event to trigger the palette
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: isMac,
      ctrlKey: !isMac,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground bg-muted/50 hover:bg-muted rounded-md border border-border transition-colors",
        className
      )}
      aria-label="Open command palette"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Search</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-background rounded border border-border font-mono text-[10px]">
        {isMac ? (
          <>
            <span className="text-xs">&#8984;</span>K
          </>
        ) : (
          <>Ctrl+K</>
        )}
      </kbd>
    </button>
  );
}
