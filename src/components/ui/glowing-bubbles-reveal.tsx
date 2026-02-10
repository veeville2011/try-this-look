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

  return (
    <div className={cn("relative rounded-lg", className)}>

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

    </div>
  )
}
