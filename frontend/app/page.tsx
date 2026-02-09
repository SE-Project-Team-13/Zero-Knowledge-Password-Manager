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
  Moon,
  User
} from "lucide-react"
import { toast } from "sonner"
import { generateAndDownloadRecoveryKey } from "@/lib/recovery"
import { apiClient } from "@/lib/api-client"
import { Check, XCircle } from "lucide-react"

/**
 * AuthPage: The main entry point for user authentication (Login/Register).
 * This page handles the ZKP-based authentication flow and local encryption of the master password.
 */
export default function AuthPage() {
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()

  // Mounted state ensures client-side only components (like theme toggles) render correctly
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // useVaultSync hook provides authentication actions and session state
  const [session, actions] = useVaultSync()

  // Form State
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Debounced email check
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
    }, 500)

    return () => clearTimeout(timer)
  }, [email])
  
  // Email check state
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'exists' | 'invalid'>('idle')

  /**
   * Handles form submission for both Login and Registration.
   * - Derives keys and performs ZKP locally before communicating with the server.
   * - Stores the master password in sessionStorage for session-long vault access.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!email || !password) {
      toast.error("Please fill in all fields")
      return
    }

    if (!isLogin && password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    if (!isLogin && !fullName) {
      toast.error("Please enter your full name")
      return
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    if (!isLogin && emailStatus === 'exists') {
      toast.error("Email is already registered")
      return
    }

    setIsSubmitting(true)
    try {
      if (isLogin) {
        // Authenticate using Zero-Knowledge Proof
        await actions.login(email, password)

        // Master password is kept in volatile sessionStorage for decryption operations
        // security: this never leaves the browser and is purged when the tab is closed
        sessionStorage.setItem("session_master_password", password)
        toast.success("Login successful!")
        router.push("/dashboard")
      } else {
        // Register new user, deriving verifiers and salts locally first
        await actions.register(email, fullName, password)

        sessionStorage.setItem("session_master_password", password)
        
        // Generate and download recovery kit automatically for new users
        toast.info("Generating your Emergency Kit...")
        try {
          const token = localStorage.getItem("auth_token")
          if (token) {
            await generateAndDownloadRecoveryKey(email, password, token, fullName)
            toast.success("Emergency Kit downloaded! Keep it safe.")
          }
        } catch (recoveryErr) {
          console.error("[Auth] Recovery key generation failed:", recoveryErr)
          toast.error("Could not auto-generate Emergency Kit. You can do this later in Settings.")
        }

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

  /**
   * Toggles between Login and Register modes and resets form state.
   */
  const toggleMode = () => {
    setIsLogin(!isLogin)
    setPassword("")
    setConfirmPassword("")
    setFullName("")
    setShowPassword(false)
    setEmailStatus('idle')
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
              {/* Full Name Field (Register only) */}
              {!isLogin && (
                <div className="space-y-2 pb-2">
                  <Label htmlFor="fullName" className="text-foreground/80">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      className="pl-10 bg-secondary/50 border-input focus:border-primary transition-colors"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>
              )}

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
                  <div className="absolute right-3 top-3 flex items-center gap-2">
                    {emailStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {emailStatus === 'available' && !isLogin && <Check className="h-4 w-4 text-emerald-500" />}
                    {emailStatus === 'exists' && !isLogin && <XCircle className="h-4 w-4 text-destructive" />}
                    {emailStatus === 'exists' && isLogin && <Check className="h-4 w-4 text-emerald-500" />}
                    {emailStatus === 'available' && isLogin && <XCircle className="h-4 w-4 text-amber-500" />}
                  </div>
                </div>
                {!isLogin && emailStatus === 'exists' && (
                  <p className="text-[10px] text-destructive font-medium mt-1 ml-1">
                    This email is already registered. Please sign in or use another email.
                  </p>
                )}
                {isLogin && emailStatus === 'available' && email.includes('@') && (
                  <p className="text-[10px] text-amber-500 font-medium mt-1 ml-1">
                    No account found with this email. Please check your spelling or register.
                  </p>
                )}
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

              {/* Recovery Key Link */}
              {isLogin && (
                <div className="text-center text-sm">
                  <a
                    href="/recovery-login"
                    className="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1"
                  >
                    <Key className="h-3 w-3" />
                    Forgot Password? Use Recovery Key
                  </a>
                </div>
              )}
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
