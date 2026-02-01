"use client";

/**
 * Chat Bubble Component
 * Animated chat messages for conversational onboarding
 */

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { KoyaAvatar } from "./koya-avatar";

interface ChatBubbleProps {
  message: string;
  isKoya?: boolean;
  isTyping?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function ChatBubble({
  message,
  isKoya = false,
  isTyping = false,
  children,
  className,
}: ChatBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "flex gap-3",
        isKoya ? "flex-row" : "flex-row-reverse",
        className
      )}
    >
      {isKoya && (
        <div className="flex-shrink-0">
          <KoyaAvatar state={isTyping ? "thinking" : "idle"} size="sm" />
        </div>
      )}

      <div
        className={cn(
          "flex flex-col gap-2 max-w-[80%]",
          isKoya ? "items-start" : "items-end"
        )}
      >
        <div
          className={cn(
            "px-4 py-3 rounded-2xl",
            isKoya
              ? "bg-card border border-border rounded-tl-sm"
              : "bg-primary text-primary-foreground rounded-tr-sm"
          )}
        >
          {isTyping ? (
            <TypingIndicator />
          ) : (
            <p className="text-sm leading-relaxed">{message}</p>
          )}
        </div>

        {/* Interactive content (buttons, inputs, etc.) */}
        {children && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full"
          >
            {children}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 py-1 px-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-muted-foreground/50 rounded-full"
          animate={{ y: [-2, 2, -2] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  );
}

// User response bubble variant
export function UserResponse({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-end"
    >
      <div className="bg-primary text-primary-foreground px-4 py-3 rounded-2xl rounded-tr-sm max-w-[80%]">
        {children}
      </div>
    </motion.div>
  );
}
