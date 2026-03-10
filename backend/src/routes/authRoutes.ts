/**
 * Authentication routes: register and login.
 * These endpoints implement the SRP-style verifier authentication.
 */

import { Router, type Request, type Response } from "express";
import * as crypto from "crypto";
import {
  registerUser,
  authenticateUser,
  generateSessionToken,
  getUserSalt,
  validateSessionToken,
  updateUserCredentials,
  checkUserExists,
  deleteUserAccount,
  generateLoginChallenge,
  invalidateSessionToken,
  markSessionOtpVerified,
} from "../services/authService.js";
import { User } from "../database/models.js";
import type {
  RegisterRequest,
  LoginRequest,
  LoginResponse,
  ErrorResponse,
} from "../types/index.js";
import {
  authMiddleware,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  return token.length > 0 ? token : null;
}

export function createAuthRouter(): Router {
  const router = Router();

  /**
   * POST /auth/register
   * Register a new user with password verifier.
   */
  router.post("/register", async (req: Request, res: Response) => {
    try {
      let { email, fullName, salt, verifier, argon2Memory, argon2Iterations } =
        req.body;

      if (!email || !fullName || !salt || !verifier) {
        return res.status(400).json({
          error: "Missing required fields",
          code: "INVALID_REQUEST",
          message: "email, fullName, salt, and verifier are required",
        } as ErrorResponse);
      }

      email = email.trim().toLowerCase();
      fullName = fullName.trim();

      if (!email.includes("@")) {
        return res.status(400).json({
          error: "Invalid email",
          code: "INVALID_EMAIL",
          message: "Please provide a valid email address",
        } as ErrorResponse);
      }

      try {
        const user = await registerUser(
          email,
          fullName,
          salt,
          verifier,
          argon2Memory,
          argon2Iterations,
        );
        // Newly registered users are implicitly verified for their first session
        // so they can generate their recovery key immediately.
        const sessionToken = await generateSessionToken(user.id, 24 * 60, true);

        return res.status(201).json({
          userId: user.id,
          fullName: user.fullName,
          salt: user.salt,
          sessionToken,
        });
      } catch (dbError) {
        if (
          typeof dbError === "object" &&
          dbError !== null &&
          "code" in dbError &&
          (dbError as { code?: number }).code === 11000
        ) {
          return res.status(409).json({
            error: "User already exists",
            code: "USER_EXISTS",
            message: "An account with this email already exists",
          } as ErrorResponse);
        }
        throw dbError;
      }
    } catch (error) {
      console.error("[VaultSync] Register error:", error);
      return res.status(500).json({
        error: "Registration failed",
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred during registration",
      } as ErrorResponse);
    }
  });

  /**
   * POST /auth/login
   * Authenticate user with SRP-style verifier.
   */
  router.post("/login", async (req: Request, res: Response) => {
    try {
      let { email, challenge, clientProof } = req.body as LoginRequest;

      if (!email || !challenge || !clientProof) {
        return res.status(400).json({
          error: "Missing required fields",
          code: "INVALID_REQUEST",
          message: "email, challenge, and clientProof are required",
        } as ErrorResponse);
      }

      email = email.trim().toLowerCase();

      const authResult = await authenticateUser(email, challenge, clientProof);

      if (!authResult.success) {
        return res.status(401).json({
          error: "Wrong password",
          code: "AUTH_FAILED",
          message: authResult.error || "Invalid email or password",
        } as ErrorResponse);
      }

      const user = authResult.user!;
      const sessionToken = await generateSessionToken(user.id, 24 * 60, false); // Always require OTP
      const serverProof = crypto
        .createHash("sha256")
        .update(user.verifier + challenge)
        .digest("hex");

      const response = {
        userId: user.id,
        fullName: user.fullName,
        sessionToken,
        salt: user.salt,
        serverProof,
        isBreached: user.isBreached,
        lastBreachCheck: user.lastBreachCheck,
        is2faEnabled: true, // Enforced 2FA globally
      };

      return res.status(200).json(response);
    } catch (error) {
      console.error("[VaultSync] Login error:", error);
      return res.status(500).json({
        error: "Login failed",
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred during login",
      } as ErrorResponse);
    }
  });

  /**
   * GET /auth/me
   * Get the current authenticated user's profile.
   */
  router.get(
    "/me",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const user = await User.findById(req.userId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({
          userId: user._id.toString(),
          email: user.email,
          fullName: user.fullName,
          isBreached: user.isBreached,
          lastBreachCheck: user.lastBreachCheck,
          is2faEnabled: true,
        });
      } catch (error) {
        console.error("[Auth] Me error:", error);
        return res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  /**
   * GET /auth/salt/:email
   * Fetch the salt for a given user email.
   */
  router.get("/salt/:email", async (req: Request, res: Response) => {
    try {
      let { email } = req.params;
      if (email) email = email.trim().toLowerCase();
      const saltData = await getUserSalt(email);
      const challenge = await generateLoginChallenge(email);

      if (!saltData) {
        return res.status(404).json({
          error: "User not found",
          code: "USER_NOT_FOUND",
          message: "No account found with this email",
        } as ErrorResponse);
      }

      return res.status(200).json({
        salt: saltData.salt,
        challenge,
        argon2Memory: saltData.argon2Memory,
        argon2Iterations: saltData.argon2Iterations,
      });
    } catch (error) {
      console.error("[VaultSync] Salt fetch error:", error);
      return res.status(500).json({
        error: "Failed to fetch salt",
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      } as ErrorResponse);
    }
  });

  /**
   * GET /auth/check-email/:email
   * Check if an email is already registered.
   */
  router.get("/check-email/:email", async (req: Request, res: Response) => {
    try {
      let { email } = req.params;
      if (email) email = email.trim().toLowerCase();
      const exists = await checkUserExists(email);
      return res.status(200).json({ exists });
    } catch (error) {
      console.error("[VaultSync] Email check error:", error);
      return res.status(500).json({
        error: "Failed to check email",
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      } as ErrorResponse);
    }
  });

  /**
   * POST /auth/reset-password
   * Resets the user's password (verifier) and salt.
   * Requires a valid session token (e.g. from recovery login).
   */
  router.post("/reset-password", async (req: Request, res: Response) => {
    try {
      const token = extractBearerToken(req.headers.authorization);
      if (!token) {
        const errorResponse: ErrorResponse = {
          error: "Unauthorized",
          code: "UNAUTHORIZED",
          message: "Missing or invalid session token",
        };
        return res.status(401).json(errorResponse);
      }
      const sessionValidation = await validateSessionToken(token);

      if (!sessionValidation.valid || !sessionValidation.userId) {
        const errorResponse: ErrorResponse = {
          error: "Unauthorized",
          code: "UNAUTHORIZED",
          message: "Invalid or expired session token",
        };
        return res.status(401).json(errorResponse);
      }

      const {
        salt,
        verifier,
        argon2Memory,
        argon2Iterations,
        encryptedVault,
        confirmVaultDeletion,
      } = req.body;

      if (!salt || !verifier) {
        const errorResponse: ErrorResponse = {
          error: "Missing required fields",
          code: "INVALID_REQUEST",
          message: "New salt and verifier are required",
        };
        return res.status(400).json(errorResponse);
      }

      await updateUserCredentials(
        sessionValidation.userId,
        salt,
        verifier,
        encryptedVault,
        argon2Memory,
        argon2Iterations,
        confirmVaultDeletion,
      );

      return res.status(200).json({
        success: true,
        message: "Password reset successfully",
      });
    } catch (error) {
      console.error("[VaultSync] Reset password error:", error);
      const errorResponse: ErrorResponse = {
        error: "Reset failed",
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      };
      return res.status(500).json(errorResponse);
    }
  });

  /**
   * POST /auth/resolve-breach
   * Clears the breach flag for the authenticated user.
   */
  router.post(
    "/resolve-breach",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        await User.findByIdAndUpdate(userId, { isBreached: false });

        return res.status(200).json({ success: true });
      } catch (error) {
        console.error("Error resolving breach:", error);
        return res.status(500).json({ error: "Internal error" });
      }
    },
  );

  /**
   * DELETE /auth/account
   * Permanently deletes the user account and all associated data.
   */
  router.delete("/account", async (req: Request, res: Response) => {
    try {
      const token = extractBearerToken(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const session = await validateSessionToken(token);

      if (!session.valid || !session.userId) {
        return res.status(401).json({ error: "Invalid or expired session" });
      }

      await deleteUserAccount(session.userId);

      return res
        .status(200)
        .json({ success: true, message: "Account deleted successfully" });
    } catch (error) {
      console.error("Delete account error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /auth/logout
   * Invalidates the current session token.
   */
  router.post("/logout", async (req: Request, res: Response) => {
    try {
      const token = extractBearerToken(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      await invalidateSessionToken(token);
      return res
        .status(200)
        .json({ success: true, message: "Logged out successfully" });
    } catch (error) {
      console.error("[VaultSync] Logout error:", error);
      return res.status(500).json({
        error: "Logout failed",
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred during logout",
      } as ErrorResponse);
    }
  });

  return router;
}
