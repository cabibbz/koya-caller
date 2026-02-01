"use client";

/**
 * Koya Mascot - Optimized
 * Simple static mascot with minimal CSS animation
 */

interface KoyaMascotProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function KoyaMascot({
  size = "md",
  className = "",
}: KoyaMascotProps) {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  return (
    <div className={`relative ${sizes[size]} ${className}`}>
      {/* Main face */}
      <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-500 via-violet-500 to-cyan-500 p-0.5">
        <div className="w-full h-full rounded-full bg-gradient-to-b from-zinc-900 to-black flex items-center justify-center relative">
          {/* Eyes */}
          <div className="flex gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
          {/* Smile */}
          <div className="absolute bottom-2 w-2 h-0.5 rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}
