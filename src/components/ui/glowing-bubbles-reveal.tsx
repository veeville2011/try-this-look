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
    
    // Start revealing image after bubbles begin their journey - smoother timing
    if (show) {
      const revealTimer = setTimeout(() => {
        setImageRevealed(true)
      }, 800) // Start reveal earlier for smoother transition
      
      return () => clearTimeout(revealTimer)
    } else {
      setImageRevealed(false)
    }
  }, [show])

  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)}>
      {/* Real bubbles layer - transparent bubbles with borders and highlights */}
      {bubbles.map((bubble) => (
        <motion.div
          key={bubble.id}
          className="absolute rounded-full pointer-events-none z-[5]"
          style={{
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            left: `${bubble.x}%`,
            // Real bubble effect: transparent background with border and highlights
            background: `radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.5) 15%, rgba(255, 152, 0, 0.15) 35%, rgba(255, 152, 0, 0.05) 50%, transparent 75%)`,
            border: `2px solid rgba(255, 255, 255, 0.7)`,
            boxShadow: `
              inset -15px -15px 25px rgba(255, 255, 255, 0.6),
              inset 15px 15px 25px rgba(255, 152, 0, 0.15),
              0 0 20px rgba(255, 255, 255, 0.4),
              0 0 40px rgba(255, 152, 0, 0.25)
            `,
            backdropFilter: 'blur(2px)',
          }}
          initial={{ 
            opacity: 0, 
            scale: 0.2,
            y: 0,
            x: "-50%",
            rotate: 0,
          }}
          animate={
            show
              ? {
                  opacity: [0, bubble.opacity, bubble.opacity * 0.8, bubble.opacity * 0.5, 0], // Smooth fade out
                  scale: [0.2, 0.7, 1.1, 1.6, 2.0], // Gradual, smooth expansion
                  y: [0, -bubble.y * 0.2, -bubble.y * 0.5, -bubble.y * 0.8, -bubble.y], // Smooth upward movement
                  x: ["-50%", "-50%", "-48%", "-52%", "-50%"], // Subtle wobble
                  rotate: [0, 5, -3, 4, 0], // Gentle rotation for realism
                }
              : { 
                  opacity: 0, 
                  scale: 0.2,
                  y: 0,
                  rotate: 0,
                }
          }
          transition={{
            delay: bubble.delay,
            duration: bubble.duration,
            ease: [0.25, 0.46, 0.45, 0.94], // Smooth, elegant ease-out curve
            times: [0, 0.2, 0.5, 0.8, 1], // Smooth keyframe timing
          }}
        >
          {/* Bubble highlight/reflection */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: '35%',
              height: '35%',
              top: '15%',
              left: '15%',
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
              borderRadius: '50%',
            }}
            animate={
              show
                ? {
                    opacity: [0, 0.9, 0.7, 0.4, 0],
                    scale: [0.5, 1, 1.2, 1.5, 2],
                  }
                : { opacity: 0, scale: 0.5 }
            }
            transition={{
              delay: bubble.delay,
              duration: bubble.duration,
              ease: [0.25, 0.46, 0.45, 0.94],
              times: [0, 0.2, 0.5, 0.8, 1],
            }}
          />
        </motion.div>
      ))}

      {/* Smaller real bubbles for subtle depth */}
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
              // Real small bubble effect
              background: `radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.4) 20%, rgba(255, 152, 0, 0.1) 40%, transparent 70%)`,
              border: `1.5px solid rgba(255, 255, 255, 0.6)`,
              boxShadow: `
                inset -8px -8px 15px rgba(255, 255, 255, 0.5),
                inset 8px 8px 15px rgba(255, 152, 0, 0.1),
                0 0 10px rgba(255, 255, 255, 0.3),
                0 0 20px rgba(255, 152, 0, 0.2)
              `,
              backdropFilter: 'blur(1px)',
            }}
            initial={{ 
              opacity: 0, 
              scale: 0.15,
              y: 0,
              x: "-50%",
              rotate: 0,
            }}
            animate={
              show
                ? {
                    opacity: [0, 0.6, 0.5, 0.3, 0], // Smooth fade
                    scale: [0.15, 0.6, 1.0, 1.4, 1.8], // Smooth expansion
                    y: [0, -startY * 0.25, -startY * 0.5, -startY * 0.75, -startY], // Smooth upward
                    x: ["-50%", "-50%", "-48%", "-52%", "-50%"], // Subtle wobble
                    rotate: [0, 3, -2, 3, 0], // Gentle rotation
                  }
                : { 
                    opacity: 0, 
                    scale: 0.15,
                    y: 0,
                    rotate: 0,
                  }
            }
            transition={{
              delay: delay,
              duration: duration,
              ease: [0.25, 0.46, 0.45, 0.94], // Smooth, elegant ease-out
              times: [0, 0.25, 0.55, 0.8, 1], // Smooth keyframe timing
            }}
          >
            {/* Small bubble highlight */}
            <motion.div
              className="absolute rounded-full"
              style={{
                width: '30%',
                height: '30%',
                top: '15%',
                left: '15%',
                background: 'radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)',
                borderRadius: '50%',
              }}
              animate={
                show
                  ? {
                      opacity: [0, 0.8, 0.6, 0.3, 0],
                      scale: [0.5, 1, 1.3, 1.6, 2],
                    }
                  : { opacity: 0, scale: 0.5 }
              }
              transition={{
                delay: delay,
                duration: duration,
                ease: [0.25, 0.46, 0.45, 0.94],
                times: [0, 0.25, 0.55, 0.8, 1],
              }}
            />
          </motion.div>
        )
      })}

      {/* Content (image) - smooth, gradual reveal */}
      <motion.div 
        className="relative z-10"
        initial={!show ? { opacity: 1, filter: "blur(0px) brightness(1)", scale: 1 } : { opacity: 0, filter: "blur(15px) brightness(0.4)", scale: 0.95 }}
        animate={imageRevealed || !show ? { 
          // If show is false (viewing past try-on), always show image immediately
          opacity: 1, 
          filter: "blur(0px) brightness(1)",
          scale: 1,
        } : { 
          opacity: 0, 
          filter: "blur(15px) brightness(0.4)",
          scale: 0.95,
        }}
        transition={!show ? {
          // Instant reveal for past try-ons
          duration: 0,
        } : {
          duration: 2.2, // Smooth, gradual reveal
          delay: 0.4, // Start reveal earlier for smoother transition
          ease: [0.2, 0, 0.2, 1], // Smooth ease-in-out curve for natural appearance
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}
