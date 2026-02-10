"use client"

import React, { useEffect, useState } from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

interface GlowingBubblesRevealProps {
  children: React.ReactNode
  className?: string
  show?: boolean
}

interface Bulb {
  id: number
  size: number
  x: number
  y: number
  delay: number
  duration: number
  opacity: number
  glowIntensity: number
  pulseSpeed: number
  colorScheme: 'warm' | 'cool' | 'vibrant' | 'amber'
}

interface Sparkle {
  id: number
  x: number
  y: number
  size: number
  delay: number
  duration: number
}

const bulbColors = {
  warm: {
    glass: ['rgba(255, 240, 180, {i})', 'rgba(255, 210, 120, {i})', 'rgba(255, 180, 80, {i})'],
    filament: 'rgba(255, 230, 120, {i})',
    glow: ['rgba(255, 245, 210, {i})', 'rgba(255, 210, 120, {i})', 'rgba(255, 180, 80, {i})'],
  },
  cool: {
    glass: ['rgba(220, 240, 255, {i})', 'rgba(160, 210, 255, {i})', 'rgba(100, 180, 255, {i})'],
    filament: 'rgba(200, 230, 255, {i})',
    glow: ['rgba(235, 245, 255, {i})', 'rgba(160, 210, 255, {i})', 'rgba(100, 180, 255, {i})'],
  },
  vibrant: {
    glass: ['rgba(255, 220, 240, {i})', 'rgba(255, 160, 210, {i})', 'rgba(255, 100, 180, {i})'],
    filament: 'rgba(255, 200, 230, {i})',
    glow: ['rgba(255, 235, 245, {i})', 'rgba(255, 160, 210, {i})', 'rgba(255, 100, 180, {i})'],
  },
  amber: {
    glass: ['rgba(255, 210, 120, {i})', 'rgba(255, 180, 80, {i})', 'rgba(240, 160, 60, {i})'],
    filament: 'rgba(255, 200, 100, {i})',
    glow: ['rgba(255, 230, 170, {i})', 'rgba(255, 200, 100, {i})', 'rgba(240, 160, 60, {i})'],
  },
}

export const GlowingBubblesReveal: React.FC<GlowingBubblesRevealProps> = ({
  children,
  className,
  show = true,
}) => {
  const [bulbs, setBulbs] = useState<Bulb[]>([])
  const [sparkles, setSparkles] = useState<Sparkle[]>([])
  const [imageRevealed, setImageRevealed] = useState(false)

  useEffect(() => {
    // Generate fewer, elegant light bulbs for clean, premium experience
    const generateBulbs = (): Bulb[] => {
      const bulbCount = 6 // Reduced for cleaner, more elegant experience
      const colorOptions: Array<'warm' | 'cool' | 'vibrant' | 'amber'> = ['warm', 'cool', 'vibrant', 'amber']
      
      return Array.from({ length: bulbCount }, (_, i) => ({
        id: i,
        size: Math.random() * 70 + 80, // 80-150px - good visibility without overwhelming
        x: (100 / (bulbCount + 1)) * (i + 1) + (Math.random() - 0.5) * 15, // Evenly distributed across width
        y: 100 + Math.random() * 20, // Start from bottom
        delay: i * 0.12, // Staggered in sequence for smooth flow
        duration: 5.5 + Math.random() * 1.0, // 5.5-6.5s - smooth but not too slow
        opacity: 0.75 + Math.random() * 0.2, // 0.75-0.95 - good visibility
        glowIntensity: 0.8 + Math.random() * 0.2, // 0.8-1.0 - strong glow
        pulseSpeed: 2.5 + Math.random() * 0.5, // 2.5-3.0s - gentle pulse
        colorScheme: colorOptions[i % colorOptions.length], // Distribute colors evenly
      }))
    }

    const generateSparkles = (): Sparkle[] => {
      const sparkleCount = 12 // Reduced for elegance
      return Array.from({ length: sparkleCount }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: 20 + Math.random() * 60, // Focus in center area
        size: Math.random() * 3 + 2.5, // 2.5-5.5px
        delay: Math.random() * 1.5,
        duration: Math.random() * 2.0 + 1.2, // 1.2-3.2s
      }))
    }

    setBulbs(generateBulbs())
    setSparkles(generateSparkles())
    
    if (show) {
      const revealTimer = setTimeout(() => {
        setImageRevealed(true)
      }, 600) // Quick but smooth reveal
      
      return () => clearTimeout(revealTimer)
    } else {
      setImageRevealed(false)
    }
  }, [show])

  const c = (str: string, intensity: number) => str.replace('{i}', String(intensity))

  return (
    <div className={cn("relative rounded-lg", className)}>
      {/* Elegant glowing light bulbs - fewer, well-placed */}
      {show && bulbs.map((bulb) => {
        const colors = bulbColors[bulb.colorScheme]
        
        return (
          <motion.div
            key={bulb.id}
            className="absolute pointer-events-none z-[5]"
            style={{
              width: `${bulb.size}px`,
              height: `${bulb.size * 1.35}px`,
              left: `${bulb.x}%`,
            }}
            initial={{ 
              opacity: 0, 
              scale: 0.15,
              y: 0,
              x: "-50%",
              rotate: 0,
            }}
            animate={{
              opacity: [0, bulb.opacity * 1.1, bulb.opacity * 0.95, bulb.opacity * 0.65, bulb.opacity * 0.35, 0],
              scale: [0.15, 0.6, 1.0, 1.45, 1.9, 2.3],
              y: [0, -bulb.y * 0.2, -bulb.y * 0.45, -bulb.y * 0.7, -bulb.y * 0.9, -bulb.y],
              x: ["-50%", "-50%", "-49%", "-51%", "-50%", "-50%"],
              rotate: [0, 6, -4, 5, -3, 0],
            }}
            transition={{
              delay: bulb.delay,
              duration: bulb.duration,
              ease: [0.22, 1, 0.36, 1], // Smooth, elegant ease
              times: [0, 0.2, 0.45, 0.7, 0.9, 1],
            }}
          >
            {/* Outer glow aura */}
            <motion.div
              className="absolute -inset-6 rounded-full"
              style={{
                background: `radial-gradient(ellipse at center, 
                  ${c(colors.glow[0], 0.5 * bulb.glowIntensity)} 0%, 
                  ${c(colors.glow[1], 0.3 * bulb.glowIntensity)} 35%, 
                  ${c(colors.glow[2], 0.12 * bulb.glowIntensity)} 60%, 
                  transparent 80%)`,
                filter: 'blur(18px)',
              }}
              animate={show ? {
                scale: [1, 1.2, 1.05, 1.15, 1],
                opacity: [0.5, 0.85, 0.65, 0.8, 0.5],
              } : { scale: 1, opacity: 0 }}
              transition={{
                duration: bulb.pulseSpeed,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* Bulb base/socket */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2"
              style={{
                width: `${bulb.size * 0.32}px`,
                height: `${bulb.size * 0.22}px`,
                background: 'linear-gradient(to bottom, rgba(85, 85, 85, 0.9), rgba(65, 65, 65, 0.95))',
                borderRadius: '0 0 6px 6px',
                boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.3)',
              }}
            />

            {/* Main bulb glass */}
            <div
              className="absolute inset-x-0 top-0"
              style={{
                height: `${bulb.size * 1.13}px`,
                borderRadius: `${bulb.size * 0.5}px ${bulb.size * 0.5}px ${bulb.size * 0.28}px ${bulb.size * 0.28}px`,
                background: `radial-gradient(ellipse at 38% 32%, 
                  rgba(255, 255, 255, ${0.92 * bulb.glowIntensity}) 0%,
                  ${c(colors.glass[0], 0.8 * bulb.glowIntensity)} 10%,
                  ${c(colors.glass[1], 0.55 * bulb.glowIntensity)} 30%,
                  ${c(colors.glass[1], 0.38 * bulb.glowIntensity)} 50%,
                  ${c(colors.glass[2], 0.22 * bulb.glowIntensity)} 70%,
                  ${c(colors.glass[2], 0.1 * bulb.glowIntensity)} 85%,
                  transparent 94%)`,
                border: `2.5px solid ${c(colors.glass[0], 0.82 * bulb.glowIntensity)}`,
                boxShadow: `
                  inset -14px -18px 26px rgba(255, 255, 255, ${0.58 * bulb.glowIntensity}),
                  inset 14px 18px 26px ${c(colors.glass[1], 0.22 * bulb.glowIntensity)},
                  0 0 ${42 * bulb.glowIntensity}px ${c(colors.glow[0], 0.65 * bulb.glowIntensity)},
                  0 0 ${72 * bulb.glowIntensity}px ${c(colors.glow[1], 0.45 * bulb.glowIntensity)},
                  0 0 ${110 * bulb.glowIntensity}px ${c(colors.glow[2], 0.25 * bulb.glowIntensity)}
                `,
                backdropFilter: 'blur(5px)',
                position: 'relative',
              }}
            >
              {/* Glass highlight */}
              <motion.div
                className="absolute rounded-full"
                style={{
                  width: '46%',
                  height: '36%',
                  top: '10%',
                  left: '8%',
                  background: `radial-gradient(ellipse at 50% 50%, 
                    rgba(255, 255, 255, ${0.93 * bulb.glowIntensity}) 0%, 
                    rgba(255, 255, 255, ${0.58 * bulb.glowIntensity}) 42%, 
                    transparent 82%)`,
                  filter: 'blur(4px)',
                  borderRadius: '50% 50% 38% 38%',
                }}
                animate={show ? {
                  opacity: [0, 1, 0.92, 0.68, 0.38, 0],
                  scale: [0.3, 1, 1.22, 1.52, 1.82, 2.12],
                } : { opacity: 0, scale: 0.3 }}
                transition={{
                  delay: bulb.delay,
                  duration: bulb.duration,
                  ease: [0.22, 1, 0.36, 1],
                  times: [0, 0.2, 0.45, 0.7, 0.9, 1],
                }}
              />

              {/* Filament - glowing wire */}
              <motion.div
                className="absolute"
                style={{
                  width: '16%',
                  height: '42%',
                  top: '30%',
                  left: '42%',
                  background: `linear-gradient(to bottom, 
                    ${c(colors.filament, 1 * bulb.glowIntensity)} 0%,
                    ${c(colors.filament, 0.93 * bulb.glowIntensity)} 30%,
                    ${c(colors.filament, 0.88 * bulb.glowIntensity)} 60%,
                    ${c(colors.filament, 0.8 * bulb.glowIntensity)} 100%)`,
                  borderRadius: '38% 38% 32% 32%',
                  boxShadow: `
                    0 0 ${22 * bulb.glowIntensity}px ${c(colors.filament, 0.88 * bulb.glowIntensity)},
                    0 0 ${38 * bulb.glowIntensity}px ${c(colors.glass[1], 0.58 * bulb.glowIntensity)}
                  `,
                  filter: 'blur(1.2px)',
                }}
                animate={show ? {
                  opacity: [0, 1, 0.95, 0.82, 0.55, 0],
                  boxShadow: [
                    `0 0 ${18 * bulb.glowIntensity}px ${c(colors.filament, 0.78 * bulb.glowIntensity)}, 0 0 ${32 * bulb.glowIntensity}px ${c(colors.glass[1], 0.48 * bulb.glowIntensity)}`,
                    `0 0 ${26 * bulb.glowIntensity}px ${c(colors.filament, 0.98 * bulb.glowIntensity)}, 0 0 ${46 * bulb.glowIntensity}px ${c(colors.glass[1], 0.68 * bulb.glowIntensity)}`,
                  ],
                } : { opacity: 0 }}
                transition={{
                  delay: bulb.delay + 0.08,
                  duration: bulb.duration * 0.92,
                  ease: [0.22, 1, 0.36, 1],
                  times: [0, 0.22, 0.48, 0.72, 0.92, 1],
                  boxShadow: {
                    duration: bulb.pulseSpeed,
                    repeat: Infinity,
                    ease: "easeInOut",
                  },
                }}
              />

              {/* Filament support wire */}
              <div
                className="absolute"
                style={{
                  width: '1.5px',
                  height: '18%',
                  top: '72%',
                  left: '49.25%',
                  background: `linear-gradient(to bottom, ${c(colors.filament, 0.45 * bulb.glowIntensity)}, rgba(100, 100, 100, 0.38))`,
                  filter: 'blur(0.4px)',
                }}
              />
            </div>

            {/* Light rays - fewer, cleaner */}
            {[0, 1, 2, 3, 4, 5].map((rayIndex) => (
              <motion.div
                key={`ray-${rayIndex}`}
                className="absolute"
                style={{
                  width: '2.5px',
                  height: `${bulb.size * 0.75}px`,
                  top: '42%',
                  left: '50%',
                  background: `linear-gradient(to bottom, 
                    ${c(colors.glow[0], 0.75 * bulb.glowIntensity)} 0%, 
                    ${c(colors.glow[1], 0.48 * bulb.glowIntensity)} 42%, 
                    transparent 100%)`,
                  transformOrigin: 'top center',
                  transform: `translateX(-50%) rotate(${rayIndex * 60}deg)`,
                  filter: 'blur(3px)',
                }}
                animate={show ? {
                  opacity: [0, 0.68, 0.52, 0.32, 0],
                  scaleY: [0, 1.15, 1.35, 1.65, 1.95],
                } : { opacity: 0, scaleY: 0 }}
                transition={{
                  delay: bulb.delay + rayIndex * 0.04,
                  duration: bulb.duration * 0.88,
                  ease: [0.22, 1, 0.36, 1],
                  times: [0, 0.28, 0.54, 0.78, 1],
                }}
              />
            ))}
          </motion.div>
        )
      })}

      {/* Fewer, elegant sparkles */}
      {show && sparkles.map((sparkle) => (
        <motion.div
          key={`sparkle-${sparkle.id}`}
          className="absolute pointer-events-none z-[6]"
          style={{
            width: `${sparkle.size}px`,
            height: `${sparkle.size}px`,
            left: `${sparkle.x}%`,
            top: `${sparkle.y}%`,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 255, 230, 1) 0%, rgba(255, 245, 200, 0.75) 50%, transparent 100%)',
            boxShadow: '0 0 10px rgba(255, 245, 200, 0.85)',
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0.88, 0],
            scale: [0, 1.25, 1.12, 0],
          }}
          transition={{
            delay: sparkle.delay,
            duration: sparkle.duration,
            ease: "easeOut",
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
              background: 'rgba(255, 255, 235, 0.95)',
            }}
          />
        </motion.div>
      ))}

      {/* Content with smooth, elegant reveal */}
      <motion.div 
        className="relative z-10"
        initial={!show ? { 
          opacity: 1, 
          filter: "blur(0px) brightness(1) saturate(1)", 
          scale: 1 
        } : { 
          opacity: 0, 
          filter: "blur(22px) brightness(0.3) saturate(0.5)", 
          scale: 0.94 
        }}
        animate={imageRevealed || !show ? { 
          opacity: 1, 
          filter: "blur(0px) brightness(1) saturate(1)",
          scale: 1,
        } : { 
          opacity: 0, 
          filter: "blur(22px) brightness(0.3) saturate(0.5)",
          scale: 0.94,
        }}
        transition={!show ? {
          duration: 0,
        } : {
          duration: 3.2, // Faster, more responsive
          delay: 0.35, // Quick start
          ease: [0.25, 1, 0.4, 1], // Smooth, elegant ease
        }}
      >
        {children}
      </motion.div>

      {/* Subtle ambient light wash */}
      {show && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-[3] rounded-lg"
          style={{
            background: 'radial-gradient(circle at center, rgba(255, 235, 200, 0.12) 0%, rgba(255, 210, 160, 0.06) 55%, transparent 80%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.65, 0.35, 0] }}
          transition={{
            duration: 3.8,
            ease: "easeInOut",
          }}
        />
      )}
    </div>
  )
}
