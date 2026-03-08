"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useVaultSync } from "@/hooks/useVaultSync"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Image from "next/image"
import {
  Shield,
  Key,
  Mail,
  Eye,
  EyeOff,
  LogIn,
  ShieldCheck,
  AlertCircle,
  Check,
  XCircle,
  Lock
} from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client"

export default function LoginPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const [session, actions] = useVaultSync()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'exists' | 'invalid'>('idle')

  useEffect(() => {
    if (!email || !email.includes('@')) {
      setEmailStatus('idle')
      return
    }

    const timer = setTimeout(async () => {
      setEmailStatus('checking')
      try {
        const { exists } = await apiClient.checkEmail(email)
        setEmailStatus(exists ? 'exists' : 'available')
      } catch (err) {
        setEmailStatus('idle')
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast.error("Please fill in all fields")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await actions.login(email, password)
      sessionStorage.setItem("session_master_password", password)
      toast.success("Login successful!")
      
      if (result.is2faEnabled) {
        router.push("/otp")
      } else {
        router.push("/dashboard")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Wrong password"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4">
            <Image 
              src="/logo.png" 
              alt="Zenith Vault Logo" 
              width={96}
              height={96}
              className="h-24 w-24 mx-auto object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2 font-heading tracking-tight">
            Zenith <span className="text-primary">Vault</span>
          </h1>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Your passwords, encrypted end-to-end
          </p>
        </div>

        <Card className="border border-primary/25 bg-card/60 backdrop-blur-xl shadow-2xl shadow-primary/5">
          <CardHeader className="text-center space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-foreground font-heading">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your credentials to unlock your vault
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit} style={{ position: "relative" }} suppressHydrationWarning>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground/80">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    className="pl-10 bg-secondary/50 border-input focus:border-primary transition-colors"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                  <div className="absolute right-3 top-3 flex items-center gap-2">
                    {emailStatus === 'exists' && <Check className="h-4 w-4 text-emerald-500" />}
                    {emailStatus === 'available' && email.includes('@') && <XCircle className="h-4 w-4 text-amber-500" />}
                  </div>
                </div>
                {emailStatus === 'available' && email.includes('@') && (
                  <p className="text-[10px] text-amber-500 font-medium mt-1 ml-1">
                    No account found with this email. Please check your spelling or register.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground/80">Master Password</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="pl-10 pr-10 bg-secondary/50 border-input focus:border-primary transition-colors font-mono"
                    placeholder="Enter Master Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {session.error && (
                <Alert variant="destructive" className="border-destructive/30 bg-destructive/10 text-destructive">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-sm font-medium">
                    {session.error}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button
                type="submit"
                className="w-full h-11 mt-4 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 transition-all font-heading tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Authenticating..." : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/register")}
                  className="text-primary font-semibold hover:underline hover:text-primary/80 transition-colors"
                  disabled={isSubmitting}
                >
                  Sign up
                </button>
              </div>

              <div className="text-center text-sm">
                <a
                  href="/recovery-login"
                  className="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1"
                >
                  <Key className="h-3 w-3" />
                  Forgot Password? Use Recovery Key
                </a>
              </div>
            </CardFooter>
          </form>
        </Card>

        <div className="mt-8 text-center text-xs text-muted-foreground/60 space-y-2">
          <div className="flex items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-green-500" />
              AES-256-GCM
            </span>
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-primary" />
              Argon2id KDF
            </span>
            <span className="flex items-center gap-1">
              <Key className="h-3 w-3 text-primary" />
              Zero-Knowledge
            </span>
          </div>
          <p>© 2026 Zenith Vault - Secure Password Manager</p>
        </div>
      </div>
    </div>
  )
}
