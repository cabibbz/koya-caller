"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, ChevronRight, X, Sparkles } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface ChecklistData {
  businessName: string | null
  phoneNumber: boolean
  businessHours: boolean
  servicesCount: number
  faqsCount: number
  voiceId: string | null
  calendarConnected: boolean
  hasTestCall: boolean
}

interface ChecklistItem {
  id: string
  label: string
  description: string
  completed: boolean
  required: boolean
  href: string
}

interface SetupChecklistProps {
  data: ChecklistData
  businessId: string
}

const STORAGE_KEY = "setup-checklist-dismissed"

export function SetupChecklist({ data, businessId }: SetupChecklistProps) {
  const [isDismissed, setIsDismissed] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Check localStorage on mount
  useEffect(() => {
    const dismissed = localStorage.getItem(`${STORAGE_KEY}-${businessId}`)
    if (dismissed === "true") {
      setIsDismissed(true)
    }
    setIsLoaded(true)
  }, [businessId])

  // Build checklist items
  const checklistItems: ChecklistItem[] = [
    {
      id: "business-name",
      label: "Business Name",
      description: "Set your business name for caller identification",
      completed: !!data.businessName && data.businessName.trim().length > 0,
      required: true,
      href: "/settings",
    },
    {
      id: "phone-number",
      label: "Phone Number",
      description: "Add a phone number for your AI receptionist",
      completed: data.phoneNumber,
      required: true,
      href: "/settings?tab=phone-billing",
    },
    {
      id: "business-hours",
      label: "Business Hours",
      description: "Configure when your business is open",
      completed: data.businessHours,
      required: true,
      href: "/settings?tab=availability",
    },
    {
      id: "services",
      label: "Services",
      description: "Add at least one service you offer",
      completed: data.servicesCount >= 1,
      required: true,
      href: "/knowledge?tab=services",
    },
    {
      id: "faqs",
      label: "FAQs",
      description: "Add at least 3 frequently asked questions",
      completed: data.faqsCount >= 3,
      required: false,
      href: "/knowledge?tab=faqs",
    },
    {
      id: "voice",
      label: "Voice Selection",
      description: "Choose a custom voice for your AI",
      completed: data.voiceId !== null && data.voiceId !== "default",
      required: false,
      href: "/settings?tab=voice",
    },
    {
      id: "calendar",
      label: "Calendar Integration",
      description: "Connect Google or Outlook calendar",
      completed: data.calendarConnected,
      required: false,
      href: "/settings?tab=calendar",
    },
    {
      id: "test-call",
      label: "Test Call",
      description: "Make a test call to verify setup",
      completed: data.hasTestCall,
      required: false,
      href: "/calls",
    },
  ]

  // Calculate completion stats
  const totalItems = checklistItems.length
  const completedItems = checklistItems.filter((item) => item.completed).length
  const completionPercentage = Math.round((completedItems / totalItems) * 100)
  const isComplete = completionPercentage === 100

  // Handle dismiss
  const handleDismiss = () => {
    localStorage.setItem(`${STORAGE_KEY}-${businessId}`, "true")
    setIsDismissed(true)
  }

  // Don't render until loaded from localStorage
  if (!isLoaded) return null

  // Don't render if dismissed or 100% complete and user has dismissed
  if (isDismissed) return null

  // Hide if 100% complete (user can dismiss to permanently hide)
  // Show congratulations state at 100%

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "relative w-full rounded-3xl p-6",
          "bg-gradient-to-br from-zinc-900 to-zinc-900/80",
          "border border-zinc-800/50",
          "hover:border-zinc-700/50 hover:shadow-xl hover:shadow-black/20",
          "transition-all duration-300"
        )}
      >
        {/* Dismiss button - only show at 100% */}
        {isComplete && (
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-300"
            aria-label="Dismiss setup checklist"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              {isComplete ? (
                <Sparkles className="w-5 h-5 text-emerald-400" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white">
                    {completedItems}
                  </span>
                </div>
              )}
              <h3 className="font-semibold text-lg">
                {isComplete ? "Setup Complete!" : "Complete Your Setup"}
              </h3>
            </div>
            <p className="text-sm text-zinc-500 mt-1">
              {isComplete
                ? "Your AI receptionist is ready to handle calls"
                : `${completedItems} of ${totalItems} steps completed`}
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-white">
              {completionPercentage}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-6">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionPercentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full",
              isComplete
                ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                : "bg-gradient-to-r from-blue-500 to-purple-500"
            )}
          />
        </div>

        {/* Checklist items */}
        <div className="space-y-2">
          {checklistItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                href={item.href}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl transition-all",
                  "hover:bg-zinc-800/50 group",
                  item.completed && "opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
                      "border-2 transition-colors",
                      item.completed
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-zinc-600 group-hover:border-zinc-500"
                    )}
                  >
                    {item.completed && <Check className="w-3 h-3 text-white" />}
                  </div>

                  {/* Label */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          item.completed
                            ? "text-zinc-400 line-through"
                            : "text-white"
                        )}
                      >
                        {item.label}
                      </span>
                      {item.required && !item.completed && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                {!item.completed && (
                  <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                )}
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Complete action */}
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-4 pt-4 border-t border-zinc-800"
          >
            <Button
              onClick={handleDismiss}
              variant="ghost"
              className="w-full text-zinc-400 hover:text-white"
            >
              Dismiss this checklist
            </Button>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
