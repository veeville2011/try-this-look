"use client"

import React, { useEffect, useState } from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

interface GlowingBubblesRevealProps {
  children: React.ReactNode
  className?: string
  show?: boolean
}

interface Bubble {
  id: number
  size: number
  x: number
  y: number
  delay: number
  duration: number
  opacity: number
}

export const GlowingBubblesReveal: React.FC<GlowingBubblesRevealProps> = ({
  children,
  className,
  show = true,
}) => {
  const [bubbles, setBubbles] = useState<Bubble[]>([])

  useEffect(() => {
    // Generate random bubbles - larger and more prominent for bokeh effect
    const generateBubbles = (): Bubble[] => {
      const bubbleCount = 10
      return Array.from({ length: bubbleCount }, (_, i) => ({
        id: i,
        size: Math.random() * 150 + 100, // 100-250px for larger bubbles
        x: Math.random() * 100, // 0-100%
        y: Math.random() * 100, // 0-100%
        delay: Math.random() * 1.2, // 0-1.2s staggered reveal
        duration: Math.random() * 3 + 4, // 4-7s slower pulse
        opacity: Math.random() * 0.4 + 0.3, // 0.3-0.7 more visible
      }))
    }

    setBubbles(generateBubbles())
  }, [])

  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)}>
      {/* Glowing gradient background - yellow to green-yellow */}
      <motion.div
        className={cn(
          "absolute inset-0 rounded-lg",
          show ? "opacity-100" : "opacity-0"
        )}
        initial={{ opacity: 0 }}
        animate={show ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        style={{
          background: "radial-gradient(ellipse at center, rgba(255, 235, 59, 0.5) 0%, rgba(255, 245, 157, 0.4) 30%, rgba(139, 195, 74, 0.3) 60%, rgba(76, 175, 80, 0.2) 100%)",
        }}
      />

      {/* Glowing bubbles - large bokeh effect */}
      {bubbles.map((bubble) => (
        <motion.div
          key={bubble.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            left: `${bubble.x}%`,
            top: `${bubble.y}%`,
            transform: "translate(-50%, -50%)",
            background: "radial-gradient(circle, rgba(255, 235, 59, 0.7) 0%, rgba(255, 245, 157, 0.5) 30%, rgba(139, 195, 74, 0.4) 60%, transparent 80%)",
            filter: "blur(30px)",
            boxShadow: "0 0 60px rgba(255, 235, 59, 0.6), 0 0 120px rgba(139, 195, 74, 0.4), 0 0 180px rgba(76, 175, 80, 0.2)",
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={
            show
              ? {
                  opacity: [0, bubble.opacity, bubble.opacity * 0.8],
                  scale: [0, 1.3, 1],
                }
              : { opacity: 0, scale: 0 }
          }
          transition={{
            delay: bubble.delay,
            duration: bubble.duration,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Additional smaller glowing particles for depth */}
      {Array.from({ length: 15 }).map((_, i) => {
        const size = Math.random() * 60 + 30 // 30-90px
        const x = Math.random() * 100
        const y = Math.random() * 100
        const delay = Math.random() * 1.5
        const duration = Math.random() * 2.5 + 2.5

        return (
          <motion.div
            key={`particle-${i}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              left: `${x}%`,
              top: `${y}%`,
              transform: "translate(-50%, -50%)",
              background: "radial-gradient(circle, rgba(255, 235, 59, 0.9) 0%, rgba(255, 245, 157, 0.6) 40%, transparent 70%)",
              filter: "blur(12px)",
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={
              show
                ? {
                    opacity: [0, 0.7, 0],
                    scale: [0, 1.8, 0],
                  }
                : { opacity: 0, scale: 0 }
            }
            transition={{
              delay: delay,
              duration: duration,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )
      })}

      {/* Content (image) */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

