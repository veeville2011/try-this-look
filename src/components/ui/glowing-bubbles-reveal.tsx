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
  const [imageRevealed, setImageRevealed] = useState(false)

  useEffect(() => {
    // Generate fewer, more impactful bubbles for better UX
    const generateBubbles = (): Bubble[] => {
      const bubbleCount = 10 // Reduced from 15 for less visual noise
      return Array.from({ length: bubbleCount }, (_, i) => ({
        id: i,
        size: Math.random() * 120 + 70, // 70-190px for varied bubble sizes
        x: Math.random() * 100, // 0-100%
        y: 100 + Math.random() * 20, // Start from bottom (100-120%)
        delay: Math.random() * 0.4, // 0-0.4s faster staggered start
        duration: Math.random() * 1.5 + 1.8, // 1.8-3.3s faster bubble travel
        opacity: Math.random() * 0.5 + 0.4, // 0.4-0.9 visibility
      }))
    }

    setBubbles(generateBubbles())
    
    // Start revealing image faster - users want to see results quickly
    if (show) {
      const revealTimer = setTimeout(() => {
        setImageRevealed(true)
      }, 500) // Reduced from 900ms - faster reveal start
      
      return () => clearTimeout(revealTimer)
    } else {
      setImageRevealed(false)
    }
  }, [show])

  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)}>
      {/* Bubbles layer - bubbles move upward and expand, then fade out */}
      {bubbles.map((bubble) => (
        <motion.div
          key={bubble.id}
          className="absolute rounded-full pointer-events-none z-[5]"
          style={{
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            left: `${bubble.x}%`,
            background: "radial-gradient(circle, rgba(255, 235, 59, 0.85) 0%, rgba(255, 245, 157, 0.6) 30%, rgba(139, 195, 74, 0.4) 60%, transparent 85%)",
            filter: "blur(20px)",
            boxShadow: "0 0 30px rgba(255, 235, 59, 0.6), 0 0 60px rgba(139, 195, 74, 0.4)",
          }}
          initial={{ 
            opacity: 0, 
            scale: 0.3,
            y: 0,
            x: "-50%"
          }}
          animate={
            show
              ? {
                  opacity: [0, bubble.opacity, bubble.opacity * 0.5, 0], // Fade out as image reveals
                  scale: [0.3, 1.0, 1.6, 2.0], // Expand as bubble rises
                  y: [0, -bubble.y * 0.4, -bubble.y * 0.75, -bubble.y], // Move upward smoothly
                  x: "-50%",
                }
              : { 
                  opacity: 0, 
                  scale: 0.3,
                  y: 0 
                }
          }
          transition={{
            delay: bubble.delay,
            duration: bubble.duration,
            ease: [0.19, 1, 0.22, 1],
            times: [0, 0.3, 0.7, 1], // Faster fade out
          }}
        />
      ))}

      {/* Fewer smaller bubbles for subtle depth */}
      {Array.from({ length: 12 }).map((_, i) => {
        const size = Math.random() * 45 + 25 // 25-70px
        const x = Math.random() * 100
        const startY = 100 + Math.random() * 25
        const delay = Math.random() * 0.8
        const duration = Math.random() * 1.8 + 1.5

        return (
          <motion.div
            key={`small-bubble-${i}`}
            className="absolute rounded-full pointer-events-none z-[5]"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              left: `${x}%`,
              background: "radial-gradient(circle, rgba(255, 235, 59, 0.7) 0%, rgba(255, 245, 157, 0.4) 50%, transparent 75%)",
              filter: "blur(12px)",
            }}
            initial={{ 
              opacity: 0, 
              scale: 0.2,
              y: 0,
              x: "-50%"
            }}
            animate={
              show
                ? {
                    opacity: [0, 0.4, 0.3, 0], // Fade out quickly
                    scale: [0.2, 0.8, 1.4, 1.8],
                    y: [0, -startY * 0.3, -startY * 0.65, -startY],
                    x: "-50%",
                  }
                : { 
                    opacity: 0, 
                    scale: 0.2,
                    y: 0 
                  }
            }
            transition={{
              delay: delay,
              duration: duration,
              ease: [0.19, 1, 0.22, 1],
              times: [0, 0.3, 0.7, 1],
            }}
          />
        )
      })}

      {/* Content (image) - faster, smoother reveal */}
      <motion.div 
        className="relative z-10"
        initial={{ opacity: 0, filter: "blur(18px) brightness(0.4)" }}
        animate={imageRevealed ? { 
          opacity: 1, 
          filter: "blur(0px) brightness(1)",
        } : { 
          opacity: 0, 
          filter: "blur(18px) brightness(0.4)" 
        }}
        transition={{
          duration: 1.6, // Reduced from 2.2s for faster reveal
          delay: 0.2, // Reduced from 0.5s
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}
