"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useInView, useSpring, useTransform } from "framer-motion"

interface AnimatedCounterProps {
  value: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

export function AnimatedCounter({
  value,
  duration = 1.5,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })
  const [hasAnimated, setHasAnimated] = useState(false)

  const spring = useSpring(0, {
    duration: duration * 1000,
    bounce: 0,
  })

  const display = useTransform(spring, (current) => {
    return `${prefix}${current.toFixed(decimals)}${suffix}`
  })

  useEffect(() => {
    if (isInView && !hasAnimated) {
      spring.set(value)
      setHasAnimated(true)
    }
  }, [isInView, value, spring, hasAnimated])

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  )
}

interface AnimatedPercentProps {
  value: number
  duration?: number
  className?: string
}

export function AnimatedPercent({
  value,
  duration = 1.5,
  className = "",
}: AnimatedPercentProps) {
  return (
    <AnimatedCounter
      value={value}
      duration={duration}
      decimals={1}
      suffix="%"
      className={className}
    />
  )
}

interface AnimatedDurationProps {
  seconds: number
  duration?: number
  className?: string
}

export function AnimatedDuration({
  seconds,
  duration = 1.5,
  className = "",
}: AnimatedDurationProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })
  const [displayValue, setDisplayValue] = useState("0:00")

  useEffect(() => {
    if (!isInView) return

    const startTime = Date.now()
    const durationMs = duration * 1000

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / durationMs, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease out cubic
      const currentSeconds = Math.round(seconds * eased)

      const mins = Math.floor(currentSeconds / 60)
      const secs = currentSeconds % 60
      setDisplayValue(`${mins}:${secs.toString().padStart(2, "0")}`)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [isInView, seconds, duration])

  return (
    <span ref={ref} className={className}>
      {displayValue}
    </span>
  )
}
