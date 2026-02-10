"use client"

import React, { useEffect, useState } from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

interface GlowingBubblesRevealProps {
  children: React.ReactNode
  className?: string
  show?: boolean
}

export const GlowingBubblesReveal: React.FC<GlowingBubblesRevealProps> = ({
  children,
  className,
  show = true,
}) => {
  const [imageRevealed, setImageRevealed] = useState(false)

  useEffect(() => {
    if (show) {
      const revealTimer = setTimeout(() => {
        setImageRevealed(true)
      }, 800)
      
      return () => clearTimeout(revealTimer)
    } else {
      setImageRevealed(false)
    }
  }, [show])

  // Simple bulb positions and colors - positioned with proper spacing from edges
  const bulbs = [
    {
      id: 'center',
      size: 120,
      position: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
      color: { r: 255, g: 200, b: 100 },
      delay: 0,
    },
    {
      id: 'top-left',
      size: 70,
      position: { top: '18%', left: '18%', transform: 'translate(-50%, -50%)' },
      color: { r: 150, g: 200, b: 255 },
      delay: 0.1,
    },
    {
      id: 'top-right',
      size: 70,
      position: { top: '18%', left: '82%', transform: 'translate(-50%, -50%)' },
      color: { r: 255, g: 150, b: 200 },
      delay: 0.15,
    },
    {
      id: 'bottom-left',
      size: 70,
      position: { top: '82%', left: '18%', transform: 'translate(-50%, -50%)' },
      color: { r: 180, g: 255, b: 150 },
      delay: 0.2,
    },
    {
      id: 'bottom-right',
      size: 70,
      position: { top: '82%', left: '82%', transform: 'translate(-50%, -50%)' },
      color: { r: 255, g: 180, b: 100 },
      delay: 0.25,
    },
  ]

  return (
    <div className={cn("relative rounded-lg", className)}>
      {/* Simple realistic light bulbs */}
      {show && bulbs.map((bulb) => (
        <motion.div
          key={bulb.id}
          className="absolute pointer-events-none z-20"
          style={{
            width: `${bulb.size}px`,
            height: `${bulb.size * 1.4}px`,
            ...bulb.position,
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 0.9] }}
          transition={{
            delay: bulb.delay,
            duration: 2.5,
            times: [0, 0.3, 0.7, 1],
            ease: "easeInOut",
          }}
        >
          {/* Simple outer glow */}
          <motion.div
            className="absolute -inset-6 rounded-full"
            style={{
              background: `radial-gradient(circle, rgba(${bulb.color.r}, ${bulb.color.g}, ${bulb.color.b}, 0.5) 0%, rgba(${bulb.color.r}, ${bulb.color.g}, ${bulb.color.b}, 0.25) 40%, transparent 70%)`,
              filter: 'blur(15px)',
            }}
            animate={{
              opacity: [0.3, 0.8, 0.6, 0],
            }}
            transition={{
              delay: bulb.delay,
              duration: 2.5,
              ease: "easeInOut",
            }}
          />

          {/* Bulb base - simple dark base */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: `${bulb.size * 0.3}px`,
              height: `${bulb.size * 0.2}px`,
              background: 'linear-gradient(to bottom, #555, #444)',
              borderRadius: '0 0 4px 4px',
            }}
          />

          {/* Bulb glass - simple pear shape */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: `${bulb.size * 1.2}px`,
              borderRadius: `${bulb.size * 0.5}px ${bulb.size * 0.5}px ${bulb.size * 0.25}px ${bulb.size * 0.25}px`,
              background: `radial-gradient(ellipse at 40% 35%, 
                rgba(255, 255, 255, 0.9),
                rgba(${bulb.color.r}, ${bulb.color.g}, ${bulb.color.b}, 0.7) 15%,
                rgba(${bulb.color.r}, ${bulb.color.g}, ${bulb.color.b}, 0.5) 35%,
                rgba(${bulb.color.r}, ${bulb.color.g}, ${bulb.color.b}, 0.3) 60%,
                transparent 85%)`,
              border: `2px solid rgba(${bulb.color.r}, ${bulb.color.g}, ${bulb.color.b}, 0.8)`,
              boxShadow: `
                inset -10px -15px 20px rgba(255, 255, 255, 0.4),
                0 0 40px rgba(${bulb.color.r}, ${bulb.color.g}, ${bulb.color.b}, 0.6),
                0 0 70px rgba(${bulb.color.r}, ${bulb.color.g}, ${bulb.color.b}, 0.4)
              `,
            }}
          >
            {/* Simple glass highlight */}
            <div
              style={{
                position: 'absolute',
                width: '40%',
                height: '30%',
                top: '12%',
                left: '10%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, transparent 70%)',
                filter: 'blur(3px)',
              }}
            />

            {/* Simple filament */}
            <motion.div
              style={{
                position: 'absolute',
                width: '15%',
                height: '40%',
                top: '32%',
                left: '42.5%',
                borderRadius: '30%',
                background: `linear-gradient(to bottom, rgba(${bulb.color.r}, ${bulb.color.g}, ${bulb.color.b}, 1), rgba(${bulb.color.r}, ${bulb.color.g}, ${bulb.color.b}, 0.8))`,
                filter: 'blur(1px)',
              }}
              animate={{
                opacity: [0, 1, 0.9, 0],
                boxShadow: [
                  `0 0 15px rgba(${bulb.color.r}, ${bulb.color.g}, ${bulb.color.b}, 0.8)`,
                  `0 0 25px rgba(${bulb.color.r}, ${bulb.color.g}, ${bulb.color.b}, 1)`,
                  `0 0 20px rgba(${bulb.color.r}, ${bulb.color.g}, ${bulb.color.b}, 0.9)`,
                  `0 0 10px rgba(${bulb.color.r}, ${bulb.color.g}, ${bulb.color.b}, 0.5)`,
                ],
              }}
              transition={{
                delay: bulb.delay + 0.1,
                duration: 2.3,
                ease: "easeInOut",
              }}
            />
          </div>
        </motion.div>
      ))}

      {/* Content - smooth fade-in reveal */}
      <motion.div 
        className="relative z-10"
        initial={!show ? { 
          opacity: 1, 
          filter: "blur(0px) brightness(1)", 
          scale: 1 
        } : { 
          opacity: 0, 
          filter: "blur(20px) brightness(0.3)", 
          scale: 0.94 
        }}
        animate={imageRevealed || !show ? { 
          opacity: 1, 
          filter: "blur(0px) brightness(1)",
          scale: 1,
        } : { 
          opacity: 0, 
          filter: "blur(20px) brightness(0.3)",
          scale: 0.94,
        }}
        transition={!show ? {
          duration: 0,
        } : {
          duration: 2.5,
          delay: 0.4,
          ease: [0.25, 1, 0.4, 1],
        }}
      >
        {children}
      </motion.div>

      {/* Simple ambient light wash */}
      {show && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-[15] rounded-lg"
          style={{
            background: `radial-gradient(circle at 50% 50%, rgba(255, 200, 100, 0.12) 0%, transparent 50%)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.7, 0.4, 0] }}
          transition={{
            duration: 2.8,
            ease: "easeInOut",
          }}
        />
      )}
    </div>
  )
}
