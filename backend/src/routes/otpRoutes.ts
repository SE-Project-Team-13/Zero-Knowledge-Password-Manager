/**
 * OTP routes for sending and verifying one-time passwords
 */

import { Router, type Request, type Response } from "express"
import { sendOTP, verifyOTP } from "../services/otpService.js"
import { validateSessionToken, markSessionOtpVerified } from "../services/authService.js"
import type { ErrorResponse } from "../types/index.js"

import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.js"

export function createOTPRouter(): Router {
  const router = Router()

  /**
   * POST /otp/send
   * Send OTP to user's email
   */
  router.post("/send", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      let { email } = req.body
      if (email) email = email.trim().toLowerCase()

      if (!email) {
        return res.status(400).json({
          error: "Missing required field",
          code: "INVALID_REQUEST",
          message: "email is required",
        } as ErrorResponse)
      }

      if (!email.includes("@")) {
        return res.status(400).json({
          error: "Invalid email",
          code: "INVALID_EMAIL",
          message: "Please provide a valid email address",
        } as ErrorResponse)
      }

      const result = await sendOTP(email)

      if (!result.success) {
        return res.status(500).json({
          error: "Failed to send OTP",
          code: "OTP_SEND_FAILED",
          message: result.message,
        } as ErrorResponse)
      }

      return res.status(200).json({
        success: true,
        message: "OTP sent successfully",
      })
    } catch (error) {
      console.error("[OTP] Send OTP error:", error)
      return res.status(500).json({
        error: "Failed to send OTP",
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      } as ErrorResponse)
    }
  })

  /**
   * POST /otp/verify
   * Verify OTP code
   */
  router.post("/verify", async (req: Request, res: Response) => {
    try {
      let { email, code } = req.body
      if (email) email = email.trim().toLowerCase()

      if (!email || !code) {
        return res.status(400).json({
          error: "Missing required fields",
          code: "INVALID_REQUEST",
          message: "email and code are required",
        } as ErrorResponse)
      }

      const result = await verifyOTP(email, code)

      if (!result.success) {
        return res.status(401).json({
          error: "Invalid OTP",
          code: "OTP_VERIFICATION_FAILED",
          message: result.message,
        } as ErrorResponse)
      }

      // Mark session as verified if token is present
      const authHeader = req.headers.authorization
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const token = authHeader.substring(7).trim()
          if (!token) {
            console.warn("[OTP] Authorization header present but token is empty")
          } else {
            const session = await validateSessionToken(token)
            if (session.valid) {
              console.log(`[OTP] Marking session as OTP verified for user ${session.userId}`)
              await markSessionOtpVerified(token)
              console.log(`[OTP] Session marked as OTP verified successfully`)
            } else {
              console.warn(`[OTP] Session validation failed: ${session.error}`)
            }
          }
        } catch (sessionError) {
          console.error("[OTP] Error marking session as OTP verified:", sessionError)
        }
      } else {
        console.warn("[OTP] No authorization header provided, session OTP verification skipped")
      }

      return res.status(200).json({
        success: true,
        message: "OTP verified successfully",
      })
    } catch (error) {
      console.error("[OTP] Verify OTP error:", error)
      return res.status(500).json({
        error: "Failed to verify OTP",
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      } as ErrorResponse)
    }
  })

  return router
}
