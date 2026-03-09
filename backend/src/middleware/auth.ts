import { type NextFunction, type Request, type Response } from "express"
import { validateSessionToken } from "../services/authService.js"
import type { ErrorResponse } from "../types/index.js"

export type AuthenticatedRequest = Request & { userId?: string }

/**
 * Middleware to protect routes that require authentication and OTP verification.
 */
export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Missing authorization",
        code: "NO_AUTH",
        message: "Authorization header with Bearer token required",
      } as ErrorResponse)
    }

    const token = authHeader.substring(7).trim()
    if (!token) {
      return res.status(401).json({
        error: "Missing authorization",
        code: "NO_AUTH",
        message: "Authorization header with Bearer token required",
      } as ErrorResponse)
    }
    
    const validation = await validateSessionToken(token)

    if (!validation.valid) {
      return res.status(401).json({
        error: "Invalid or expired token",
        code: "INVALID_TOKEN",
        message: validation.error,
      } as ErrorResponse)
    }
    
    req.userId = validation.userId
    
    // SECURITY: Standardized OTP check for all protected routes
    // Skip OTP check for OTP-related routes to avoid deadlocks during the verification process
    // Use originalUrl to get the full path including router mount points
    const fullPath = req.originalUrl.split("?")[0];
    const isOtpRoute = fullPath.endsWith("/otp/send") || fullPath.endsWith("/otp/verify");
    const isRecoveryRoute = fullPath.includes("/recovery/generate") || fullPath.includes("/recovery/activate");

    if (!validation.isOtpVerified && !isOtpRoute && !isRecoveryRoute) {
       console.warn(`[VaultSync:Auth] Blocked: OTP verification required for user ${validation.userId} at ${req.originalUrl} (isOtpRoute: ${isOtpRoute}, isRecoveryRoute: ${isRecoveryRoute})`)
       return res.status(403).json({
         error: "OTP verification required",
         code: "OTP_REQUIRED",
         message: "Please complete 2FA verification"
       } as ErrorResponse)
    }

    next()
  } catch (error) {
    console.error("[VaultSync:Auth] Auth middleware error:", error)
    return res.status(500).json({
      error: "Auth validation failed",
      code: "INTERNAL_ERROR",
      message: "An error occurred during authentication",
    } as ErrorResponse)
  }
}
