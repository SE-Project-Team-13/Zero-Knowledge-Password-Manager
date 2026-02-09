/**
 * Blind synchronization backend for zero-knowledge password manager.
 */

import "dotenv/config"
import express from "express"
import path from "path"
import { fileURLToPath } from "url"
import { connectToDatabase, closeDatabase } from "./database/index.js"
import { SimpleVault } from "./database/models.js"
import { createAuthRouter } from "./routes/authRoutes.js"
import { createSyncRouter } from "./routes/syncRoutes.js"
import { createOTPRouter } from "./routes/otpRoutes.js"
import { createRecoveryRouter } from "./routes/recoveryRoutes.js"
import { initScheduledJobs } from "./services/cronService.js"
import helmet from "helmet"
import { rateLimit } from "express-rate-limit"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001
const isProduction = process.env.NODE_ENV === "production"
const isDebug = process.env.DEBUG === "true"

// Logger helper
const logger = {
  info: (msg: string, ...args: any[]) => {
    if (!isProduction || isDebug) console.log(`[VaultSync:Server] ${msg}`, ...args)
  },
  warn: (msg: string, ...args: any[]) => {
    if (!isProduction || isDebug) console.warn(`[VaultSync:Server] ${msg}`, ...args)
  },
  error: (msg: string, ...args: any[]) => {
    console.error(`[VaultSync:Server] ${msg}`, ...args)
  }
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/vault"

function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null
  }
  const token = authHeader.substring(7).trim()
  return token.length > 0 ? token : null
}

async function start() {
  try {
    logger.info("Starting blind synchronization backend with MongoDB...")

    // Initialize database connection
    await connectToDatabase(MONGODB_URI)

    // Initialize scheduled jobs (Cron)
    initScheduledJobs()

    const app = express()

    // Global Security Headers
    app.use(helmet())

    // CORS Middleware
    app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*")
      res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS")
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization")
      if (req.method === "OPTIONS") return res.sendStatus(200)
      next()
    })

    // Rate Limiting
    const generalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Too many requests, please try again later." }
    })

    const authLimiter = rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20, // Limit each IP to 20 auth attempts per hour
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Too many authentication attempts, please try again in an hour." }
    })

    app.use("/api/", generalLimiter)
    app.use("/auth/", authLimiter)
    app.use("/otp/send", authLimiter)

    app.use(express.json())

    // Simple request logging
    app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`)
      next()
    })

    // Standard API Routes
    app.use("/auth", createAuthRouter())
    app.use("/sync", createSyncRouter())
    app.use("/otp", createOTPRouter())
    app.use("/recovery", createRecoveryRouter())

    // Phase 3 compatibility routes
    app.get("/api/vault/:userId", async (req, res) => {
      const requestedUserId = req.params.userId?.trim()
      try {
        const token = extractBearerToken(req.headers.authorization)
        if (!token) return res.status(401).json({ error: "Unauthorized" })

        let validateSessionToken;
        try {
          const authModule = await import("./services/authService.js");
          validateSessionToken = authModule.validateSessionToken;
        } catch (importErr) {
          logger.error("Failed to load auth service:", importErr);
          return res.status(500).json({ error: "Service unavailable", code: "IMPORT_ERROR", message: "Internal dependency failed to load" });
        }
        
        const session = await validateSessionToken(token)
        
        if (!session.valid || !session.userId) return res.status(401).json({ error: "Invalid session" })

        if (!session.isOtpVerified) {
          return res.status(403).json({ error: "OTP verification required", code: "OTP_REQUIRED" })
        }

        if (!requestedUserId || session.userId !== requestedUserId) {
          return res.status(403).json({ error: "Forbidden: Access denied" })
        }
        
        let vault = await SimpleVault.findOne({ userId: requestedUserId })

        if (!vault) {
          try {
            let User;
            try {
              const modelsModule = await import("./database/models.js");
              User = modelsModule.User;
            } catch (importErr) {
              logger.error("Failed to load models for migration:", importErr);
              throw importErr; // Caught by outer catch
            }
            const user = await User.findById(session.userId)
            const legacyKey = user?.email?.toLowerCase()
            if (legacyKey) {
              const legacyVault = await SimpleVault.findOne({ userId: legacyKey })
              if (legacyVault) {
                legacyVault.userId = session.userId
                await legacyVault.save()
                vault = legacyVault
              }
            }
          } catch (err) {
            logger.error("Legacy migration failed:", err)
          }
        }

        if (!vault) return res.json({ ciphertext: null })
        res.json(vault.data)
      } catch (err) {
        logger.error("GET vault error:", err)
        res.status(500).json({ error: "Internal server error" })
      }
    })

    app.put("/api/vault/:userId", async (req, res) => {
      const requestedUserId = req.params.userId?.trim()
      try {
        const token = extractBearerToken(req.headers.authorization)
        if (!token) return res.status(401).json({ error: "Unauthorized" })

        let validateSessionToken;
        try {
          const authModule = await import("./services/authService.js");
          validateSessionToken = authModule.validateSessionToken;
        } catch (importErr) {
          logger.error("Failed to load auth service:", importErr);
          return res.status(500).json({ error: "Service unavailable", code: "IMPORT_ERROR", message: "Internal dependency failed to load" });
        }
        
        const session = await validateSessionToken(token)
        
        if (!session.valid || !session.userId) return res.status(401).json({ error: "Invalid session" })

        if (!session.isOtpVerified) {
          return res.status(403).json({ error: "OTP verification required", code: "OTP_REQUIRED" })
        }

        if (!requestedUserId || session.userId !== requestedUserId) {
          return res.status(403).json({ error: "Forbidden: Update denied" })
        }

        const { encryptedVault, labels } = req.body
        const vaultData = encryptedVault || req.body

        const vault = await SimpleVault.findOneAndUpdate(
          { userId: requestedUserId },
          {
            data: vaultData,
            labels: labels || [],
            updatedAt: new Date().toISOString().replace("T", " ").substring(0, 19)
          },
          { upsert: true, new: true }
        )

        logger.info(`Vault saved for ${requestedUserId}`)
        res.json({ success: true, updatedAt: vault?.updatedAt })
      } catch (err) {
        logger.error("PUT vault error:", err)
        res.status(500).json({ error: "Failed to save vault" })
      }
    })

    app.delete("/api/vault/:userId", async (req, res) => {
      const requestedUserId = req.params.userId?.trim()
      try {
        const token = extractBearerToken(req.headers.authorization)
        if (!token) return res.status(401).json({ error: "Unauthorized" })

        let validateSessionToken;
        try {
          const authModule = await import("./services/authService.js");
          validateSessionToken = authModule.validateSessionToken;
        } catch (importErr) {
          logger.error("Failed to load auth service:", importErr);
          return res.status(500).json({ error: "Service unavailable", code: "IMPORT_ERROR", message: "Internal dependency failed to load" });
        }
        
        const session = await validateSessionToken(token)
        
        if (!session.valid || !session.userId) return res.status(401).json({ error: "Invalid session" })

        if (!session.isOtpVerified) {
          return res.status(403).json({ error: "OTP verification required", code: "OTP_REQUIRED" })
        }

        if (!requestedUserId || session.userId !== requestedUserId) {
          return res.status(403).json({ error: "Forbidden: Delete denied" })
        }
        
        await SimpleVault.deleteOne({ userId: requestedUserId })
        logger.info(`Vault deleted for ${requestedUserId}`)
        res.json({ success: true, message: "Vault deleted" })
      } catch (err) {
        logger.error("DELETE vault error:", err)
        res.status(500).json({ error: "Failed to delete vault" })
      }
    })

    app.get("/health", (req, res) => {
      res.json({ status: "ok", db: "mongodb", timestamp: new Date().toISOString() })
    })

    app.use((req, res) => {
      res.status(404).json({ error: "Not found", code: "NOT_FOUND", message: `Endpoint ${req.path} not found` })
    })

    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error("Global Server error:", err)
      res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR", message: err.message })
    })

    const server = app.listen(PORT, () => {
      logger.info(`Blind sync backend listening on port ${PORT}`)
    })

    const shutdown = async () => {
      logger.info("Shutting down gracefully...")
      server.close(async () => {
        await closeDatabase()
        process.exit(0)
      })
    }
    process.on("SIGTERM", shutdown)
    process.on("SIGINT", shutdown)
  } catch (error) {
    console.error("[VaultSync:Server] Failed to start server:", error)
    process.exit(1)
  }
}

start()
