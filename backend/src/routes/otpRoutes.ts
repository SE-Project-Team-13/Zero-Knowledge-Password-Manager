/**
 * OTP routes for sending and verifying one-time passwords
 */

import { Router, type Request, type Response } from "express"
import { sendOTP, verifyOTP } from "../services/otpService.js"
import { markSessionOtpVerified } from "../services/authService.js"
import { User } from "../database/models.js"
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
        message: result.message || "OTP sent successfully",
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
   *
   * SECURITY: authMiddleware is intentionally applied here even though the
   * session is not yet OTP-verified (the middleware skips the OTP gate for
   * /otp/* routes).  This guarantees that:
   *  1. A valid session token is present (the user just logged in).
   *  2. req.userId is set from that session.
   * We then look up the session owner's email and assert it matches the email
   * in the request body, preventing an attacker from cross-verifying a
   * different user's OTP against a stolen session token.
   */
  router.post("/verify", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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

      // SECURITY: Verify the OTP email matches the authenticated session's owner.
      const sessionUser = await User.findById(req.userId)
      if (!sessionUser) {
        return res.status(401).json({
          error: "Unauthorized",
          code: "INVALID_TOKEN",
          message: "Session user not found",
        } as ErrorResponse)
      }

      if (sessionUser.email !== email) {
        return res.status(403).json({
          error: "Email mismatch",
          code: "OTP_EMAIL_MISMATCH",
          message: "The OTP email must match the authenticated account",
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

      // authMiddleware already validated the token; mark the session verified.
      const token = req.headers.authorization!.substring(7).trim()
      await markSessionOtpVerified(token)

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
