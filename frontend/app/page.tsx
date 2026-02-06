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
import {
  Shield,
  Lock,
  Key,
  Mail,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Sun,
  Moon
} from "lucide-react"
import { toast } from "sonner"

export default function AuthPage() {
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()
  // mounted state is still useful for initial render
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const [session, actions] = useVaultSync()

  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast.error("Please fill in all fields")
      return
    }

    if (!isLogin && password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    setIsSubmitting(true)
    try {
      if (isLogin) {
        await actions.login(email, password)
        // Store master password in session for vault decryption (persists until browser closes)
        sessionStorage.setItem("session_master_password", password)
        toast.success("Login successful!")
        router.push("/dashboard")
      } else {
        await actions.register(email, password)
        // Store master password in session for vault decryption (persists until browser closes)
        sessionStorage.setItem("session_master_password", password)
        toast.success("Account created successfully!")
        router.push("/dashboard")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleMode = () => {
    setIsLogin(!isLogin)
    setPassword("")
    setConfirmPassword("")
    setShowPassword(false)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none"></div>
      
      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto bg-primary/10 p-4 rounded-2xl w-fit mb-4 shadow-lg shadow-primary/20 border border-primary/20">
            <Shield className="h-12 w-12 text-primary animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2 font-heading tracking-tight">
            ZeroKnowledge <span className="text-primary">Vault</span>
          </h1>
          <p className="text-muted-foreground">
            Your passwords, encrypted end-to-end
          </p>
        </div>

        {/* Auth Card */}
        <Card className="border border-border shadow-2xl bg-card/60 backdrop-blur-md">
          <CardHeader className="text-center space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-foreground font-heading">
              {isLogin ? "Welcome Back" : "Create Account"}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {isLogin
                ? "Enter your credentials to unlock your vault"
                : "Start securing your passwords with zero-knowledge encryption"}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit} style={{ position: "relative" }} suppressHydrationWarning>
            <CardContent className="space-y-4">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground/80">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    className="pl-10 bg-secondary/50 border-input focus:border-primary transition-colors"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground/80">Master Password</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="pl-10 pr-10 bg-secondary/50 border-input focus:border-primary transition-colors font-mono"
                    placeholder="••••••••••••••••"
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
                {!isLogin && (
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    This password encrypts your vault locally. We never see it.
                  </p>
                )}
              </div>

              {/* Confirm Password (Register only) */}
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-foreground/80">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      className="pl-10 bg-secondary/50 border-input focus:border-primary transition-colors font-mono"
                      placeholder="••••••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Error Display */}
              {session.error && (
                <Alert variant="destructive" className="border-destructive/30 bg-destructive/10 text-destructive">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-sm font-medium">
                    {session.error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Security Notice */}
              <Alert className="bg-primary/5 border-primary/20">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <AlertDescription className="text-xs text-primary/80">
                  <strong>Zero-Knowledge Architecture:</strong> Your master password is used to derive encryption keys locally via Argon2id. The server never sees your plaintext password or decrypted data.
                </AlertDescription>
              </Alert>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 transition-all font-heading tracking-wide"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isLogin ? "Authenticating..." : "Creating Account..."}
                  </>
                ) : (
                  <>
                    {isLogin ? (
                      <>
                        <LogIn className="mr-2 h-4 w-4" />
                        Sign In
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Create Account
                      </>
                    )}
                  </>
                )}
              </Button>

              {/* Toggle Mode */}
              <div className="text-center text-sm text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                {" "}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-primary font-semibold hover:underline hover:text-primary/80 transition-colors"
                  disabled={isSubmitting}
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground/60 space-y-2">
          <div className="flex items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-green-500" />
              AES-256-GCM
            </span>
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-indigo-500" />
              Argon2id KDF
            </span>
            <span className="flex items-center gap-1">
              <Key className="h-3 w-3 text-purple-500" />
              Zero-Knowledge
            </span>
          </div>
          <p>© 2026 ZeroKnowledge Password Manager</p>
        </div>
      </div>
    </div>
  )
}
