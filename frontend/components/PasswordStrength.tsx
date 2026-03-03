"use client"

import React, { useEffect, useState } from "react"
import { Progress } from "@/components/ui/progress"
import { Check, ShieldCheck } from "lucide-react"

interface PasswordStrengthProps {
  password: string
  onStrengthChange?: (isValid: boolean) => void
}

export function PasswordStrength({ password, onStrengthChange }: PasswordStrengthProps) {
  const [strength, setStrength] = useState(0)
  const [criteria, setCriteria] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  })

  useEffect(() => {
    if (!password) {
      setStrength(0)
      setCriteria({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false
      })
      onStrengthChange?.(false)
      return
    }

    const newCriteria = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password)
    }

    setCriteria(newCriteria)
    const satisfied = Object.values(newCriteria).filter(Boolean).length
    setStrength((satisfied / 5) * 100)
    onStrengthChange?.(satisfied === 5)
  }, [password, onStrengthChange])

  const getStrengthLabel = (s: number) => {
    if (s <= 20) return "Very Weak"
    if (s <= 40) return "Weak"
    if (s <= 60) return "Medium"
    if (s <= 80) return "Strong"
    return "Very Strong"
  }

  const getStrengthColor = (s: number) => {
    if (s <= 20) return "text-destructive"
    if (s <= 40) return "text-amber-500"
    if (s <= 60) return "text-yellow-500"
    if (s <= 80) return "text-blue-500"
    return "text-emerald-500"
  }

  const getProgressColor = (s: number) => {
    if (s <= 20) return "bg-destructive"
    if (s <= 40) return "bg-amber-500"
    if (s <= 60) return "bg-yellow-500"
    if (s <= 80) return "bg-blue-500"
    return "bg-emerald-500"
  }

  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center justify-between text-sm font-medium">
        <span className="text-muted-foreground">Password Strength</span>
        <span className={getStrengthColor(strength)}>
          {getStrengthLabel(strength)}
        </span>
      </div>
      <Progress 
        value={strength} 
        className="h-1.5 transition-all" 
        indicatorClassName={getProgressColor(strength)}
      />
      
      <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/30 rounded-lg border border-primary/5">
        <div className="flex items-center gap-2">
           {criteria.length ? (
             <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
               <Check className="h-2.5 w-2.5" />
             </div>
           ) : (
             <div className="flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-muted-foreground/50">
               <div className="h-1 w-1 rounded-full bg-current" />
             </div>
           )}
           <span className={`text-xs ${criteria.length ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>8+ Characters</span>
        </div>
        <div className="flex items-center gap-2">
           {criteria.uppercase ? (
             <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
               <Check className="h-2.5 w-2.5" />
             </div>
           ) : (
             <div className="flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-muted-foreground/50">
               <div className="h-1 w-1 rounded-full bg-current" />
             </div>
           )}
           <span className={`text-xs ${criteria.uppercase ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>Uppercase</span>
        </div>
        <div className="flex items-center gap-2">
           {criteria.lowercase ? (
             <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
               <Check className="h-2.5 w-2.5" />
             </div>
           ) : (
             <div className="flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-muted-foreground/50">
               <div className="h-1 w-1 rounded-full bg-current" />
             </div>
           )}
           <span className={`text-xs ${criteria.lowercase ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>Lowercase</span>
        </div>
        <div className="flex items-center gap-2">
           {criteria.number ? (
             <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
               <Check className="h-2.5 w-2.5" />
             </div>
           ) : (
             <div className="flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-muted-foreground/50">
               <div className="h-1 w-1 rounded-full bg-current" />
             </div>
           )}
           <span className={`text-xs ${criteria.number ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>Number</span>
        </div>
        <div className="flex items-center gap-2">
           {criteria.special ? (
             <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
               <Check className="h-2.5 w-2.5" />
             </div>
           ) : (
             <div className="flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-muted-foreground/50">
               <div className="h-1 w-1 rounded-full bg-current" />
             </div>
           )}
           <span className={`text-xs ${criteria.special ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>Special Char</span>
        </div>
      </div>
    </div>
  )
}
