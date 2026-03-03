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
  User,
  Check,
  XCircle
} from "lucide-react"
import { toast } from "sonner"
import { generateAndDownloadRecoveryKey } from "@/lib/recovery"
import { apiClient } from "@/lib/api-client"
import { Progress } from "@/components/ui/progress"

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

  // Password Strength Logic
  const [strength, setStrength] = useState(0)
  const [criteria, setCriteria] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  })

  useEffect(() => {
    if (!password || isLogin) {
      setStrength(0)
      setCriteria({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false
      })
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
  }, [password, isLogin])

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

    if (!isLogin) {
      if (password.length < 8) {
        toast.error("Password must be at least 8 characters")
        return
      }
      
      const satisfiedCount = Object.values(criteria).filter(Boolean).length
      if (satisfiedCount < 5) {
        toast.error("Please satisfy all password requirements for better security")
        return
      }
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
            await generateAndDownloadRecoveryKey(email, password, token)
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
      const message = err instanceof Error ? err.message : "Wrong password"
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
          <div className="mx-auto mb-4">
            <img 
              src="/logo.png" 
              alt="Zenith Vault Logo" 
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

        {/* Auth Card */}
        <Card className="border border-primary/25 bg-card/60 backdrop-blur-xl shadow-2xl shadow-primary/5">
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
                    placeholder="Enter your email address"
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
                    placeholder="Enter your master password"
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
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span className="text-muted-foreground">Password Strength</span>
                      <span className={
                        strength <= 20 ? "text-destructive" :
                        strength <= 40 ? "text-amber-500" :
                        strength <= 60 ? "text-yellow-500" :
                        strength <= 80 ? "text-blue-500" :
                        "text-emerald-500"
                      }>
                        {strength <= 20 ? "Very Weak" :
                         strength <= 40 ? "Weak" :
                         strength <= 60 ? "Medium" :
                         strength <= 80 ? "Strong" :
                         "Very Strong"}
                      </span>
                    </div>
                    <Progress 
                      value={strength} 
                      className="h-1.5 transition-all" 
                      indicatorClassName={
                        strength <= 20 ? "bg-destructive" :
                        strength <= 40 ? "bg-amber-500" :
                        strength <= 60 ? "bg-yellow-500" :
                        strength <= 80 ? "bg-blue-500" :
                        "bg-emerald-500"
                      }
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

                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      This password encrypts your vault locally. We never see it.
                    </p>
                  </div>
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
                      placeholder="Confirm your master password"
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
                className="w-full h-11 mt-4 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 transition-all font-heading tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting || (!isLogin && Object.values(criteria).filter(Boolean).length < 5)}
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
