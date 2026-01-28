"use client"

import { motion, Variants } from "framer-motion"
import { ReactNode } from "react"

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
}

const _scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
}

interface StaggerContainerProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function StaggerContainer({
  children,
  className = "",
  delay = 0,
}: StaggerContainerProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      transition={{ delayChildren: delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface StaggerItemProps {
  children: ReactNode
  className?: string
}

export function StaggerItem({ children, className = "" }: StaggerItemProps) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  )
}

interface FadeInProps {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
}

export function FadeIn({
  children,
  className = "",
  delay = 0,
  duration = 0.5,
}: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface ScaleInProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function ScaleIn({ children, className = "", delay = 0 }: ScaleInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface HoverLiftProps {
  children: ReactNode
  className?: string
  lift?: number
}

export function HoverLift({
  children,
  className = "",
  lift = -4,
}: HoverLiftProps) {
  return (
    <motion.div
      whileHover={{ y: lift, transition: { duration: 0.2 } }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface HoverGlowProps {
  children: ReactNode
  className?: string
  glowColor?: string
}

export function HoverGlow({
  children,
  className = "",
  glowColor = "rgba(59, 130, 246, 0.5)",
}: HoverGlowProps) {
  return (
    <motion.div
      whileHover={{
        boxShadow: `0 0 30px ${glowColor}`,
        transition: { duration: 0.2 },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface HoverScaleProps {
  children: ReactNode
  className?: string
  scale?: number
}

export function HoverScale({
  children,
  className = "",
  scale = 1.02,
}: HoverScaleProps) {
  return (
    <motion.div
      whileHover={{ scale, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
