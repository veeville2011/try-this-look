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
    // Generate fewer, more elegant bubbles for premium UX feel
    const generateBubbles = (): Bubble[] => {
      const bubbleCount = 6 // Reduced significantly for cleaner, more elegant feel
      return Array.from({ length: bubbleCount }, (_, i) => ({
        id: i,
        size: Math.random() * 140 + 80, // 80-220px for varied bubble sizes
        x: Math.random() * 100, // 0-100%
        y: 100 + Math.random() * 25, // Start from bottom (100-125%)
        delay: Math.random() * 0.8 + 0.2, // 0.2-1.0s staggered start for elegant reveal
        duration: Math.random() * 2.5 + 4.5, // 4.5-7s slower, smoother bubble travel
        opacity: Math.random() * 0.4 + 0.5, // 0.5-0.9 visibility for elegant glow
      }))
    }

    setBubbles(generateBubbles())
    
    // Start revealing image after bubbles begin their elegant journey
    if (show) {
      const revealTimer = setTimeout(() => {
        setImageRevealed(true)
      }, 1200) // Slower start for more anticipation and elegance
      
      return () => clearTimeout(revealTimer)
    } else {
      setImageRevealed(false)
    }
  }, [show])

  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)}>
      {/* Bubbles layer - bubbles move upward gracefully and expand smoothly */}
      {bubbles.map((bubble) => (
        <motion.div
          key={bubble.id}
          className="absolute rounded-full pointer-events-none z-[5]"
          style={{
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            left: `${bubble.x}%`,
            background: "radial-gradient(circle, rgba(255, 235, 59, 0.8) 0%, rgba(255, 245, 157, 0.6) 25%, rgba(139, 195, 74, 0.4) 55%, transparent 85%)",
            filter: "blur(25px)",
            boxShadow: "0 0 40px rgba(255, 235, 59, 0.5), 0 0 80px rgba(139, 195, 74, 0.3)",
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
                  opacity: [0, bubble.opacity, bubble.opacity * 0.7, bubble.opacity * 0.4, 0], // Smooth fade out
                  scale: [0.2, 0.7, 1.2, 1.8, 2.2], // Gradual, smooth expansion
                  y: [0, -bubble.y * 0.2, -bubble.y * 0.5, -bubble.y * 0.8, -bubble.y], // Smooth upward movement
                  x: "-50%",
                }
              : { 
                  opacity: 0, 
                  scale: 0.2,
                  y: 0 
                }
          }
          transition={{
            delay: bubble.delay,
            duration: bubble.duration,
            ease: [0.25, 0.46, 0.45, 0.94], // Smooth, elegant ease-out curve
            times: [0, 0.2, 0.5, 0.8, 1], // Smooth keyframe timing
          }}
        />
      ))}

      {/* Fewer smaller bubbles for subtle, elegant depth */}
      {Array.from({ length: 6 }).map((_, i) => {
        const size = Math.random() * 50 + 30 // 30-80px
        const x = Math.random() * 100
        const startY = 100 + Math.random() * 30
        const delay = Math.random() * 1.2 + 0.3 // 0.3-1.5s staggered start
        const duration = Math.random() * 2.5 + 3.5 // 3.5-6s slower, smoother

        return (
          <motion.div
            key={`small-bubble-${i}`}
            className="absolute rounded-full pointer-events-none z-[5]"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              left: `${x}%`,
              background: "radial-gradient(circle, rgba(255, 235, 59, 0.65) 0%, rgba(255, 245, 157, 0.45) 45%, transparent 75%)",
              filter: "blur(15px)",
            }}
            initial={{ 
              opacity: 0, 
              scale: 0.15,
              y: 0,
              x: "-50%"
            }}
            animate={
              show
                ? {
                    opacity: [0, 0.5, 0.4, 0.2, 0], // Smooth fade
                    scale: [0.15, 0.6, 1.1, 1.6, 2.0], // Smooth expansion
                    y: [0, -startY * 0.25, -startY * 0.5, -startY * 0.75, -startY], // Smooth upward
                    x: "-50%",
                  }
                : { 
                    opacity: 0, 
                    scale: 0.15,
                    y: 0 
                  }
            }
            transition={{
              delay: delay,
              duration: duration,
              ease: [0.25, 0.46, 0.45, 0.94], // Smooth, elegant ease-out
              times: [0, 0.25, 0.55, 0.8, 1], // Smooth keyframe timing
            }}
          />
        )
      })}

      {/* Content (image) - smooth, elegant reveal */}
      <motion.div 
        className="relative z-10"
        initial={!show ? { opacity: 1, filter: "blur(0px) brightness(1)" } : { opacity: 0, filter: "blur(20px) brightness(0.3)" }}
        animate={imageRevealed || !show ? { 
          // If show is false (viewing past try-on), always show image immediately
          opacity: 1, 
          filter: "blur(0px) brightness(1)",
        } : { 
          opacity: 0, 
          filter: "blur(20px) brightness(0.3)" 
        }}
        transition={!show ? {
          // Instant reveal for past try-ons
          duration: 0,
        } : {
          duration: 2.8, // Slower, more elegant reveal
          delay: 0.8, // Delayed start for anticipation
          ease: [0.16, 1, 0.3, 1], // Smooth, elegant ease-out curve
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}
