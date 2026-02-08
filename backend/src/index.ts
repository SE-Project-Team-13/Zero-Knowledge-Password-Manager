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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/vault"

async function start() {
  try {
    console.log("[VaultSync] Starting blind synchronization backend with MongoDB...")

    // Initialize database connection
    await connectToDatabase(MONGODB_URI)

    // Create Express app instance
    const app = express()

    // CORS Middleware: Allow requests from dashboard and extension
    // In production, these should be restricted to specific origins
    app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*")
      res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS")
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization")

      if (req.method === "OPTIONS") {
        return res.sendStatus(200)
      }
      next()
    })

    // JSON Body Parser middleware
    app.use(express.json())

    // Simple request logging middleware
    app.use((req, res, next) => {
      console.log(`[VaultSync] ${req.method} ${req.path}`)
      next()
    })

    // Standard API Routes
    app.use("/auth", createAuthRouter()) // User registration and ZKP-based authentication
    app.use("/sync", createSyncRouter()) // Blind vault synchronization (merging/versioning)
    app.use("/otp", createOTPRouter())   // Email-based One-Time Passwords
    app.use("/recovery", createRecoveryRouter()) // Recovery key management

    // Phase 3 compatibility routes for extension (Now using MongoDB)
    app.get("/api/vault/:userId", async (req, res) => {
      try {
        const { userId } = req.params
        const vault = await SimpleVault.findOne({ userId })
        if (!vault) return res.status(404).json({ error: "Vault not found" })
        res.json(vault.data)
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch vault" })
      }
    })

    app.put("/api/vault/:userId", async (req, res) => {
      const { userId } = req.params
      try {
        console.log(`[VaultSync] Extension saving vault for ${userId}...`)

        // Extract data and labels (if provided)
        const { encryptedVault, labels } = req.body

        const vault = await SimpleVault.findOneAndUpdate(
          { userId },
          {
            data: encryptedVault || req.body, // Fallback for old extension version
            labels: labels || [],
            updatedAt: new Date()
          },
          { upsert: true, new: true }
        )

        console.log(`[VaultSync] Vault saved to MongoDB for ${userId} with ${labels?.length || 0} labels`)
        res.json({ success: true, updatedAt: vault?.updatedAt })
      } catch (error) {
        console.error(`[VaultSync] Failed to save vault for ${userId}:`, error)
        res.status(500).json({ error: "Failed to save vault" })
      }
    })

    // DELETE vault (for resetting/debugging)
    // WARNING: This endpoint should be protected with authentication in production
    // or removed entirely. Currently useful for development and testing.
    app.delete("/api/vault/:userId", async (req, res) => {
      try {
        const { userId } = req.params
        await SimpleVault.deleteOne({ userId })
        console.log(`[VaultSync] Vault deleted for ${userId}`)
        res.json({ success: true, message: "Vault deleted" })
      } catch (error) {
        console.error(`[VaultSync] Failed to delete vault:`, error)
        res.status(500).json({ error: "Failed to delete vault" })
      }
    })

    // Health check endpoint
    app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        db: "mongodb",
        timestamp: new Date().toISOString()
      })
    })

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        error: "Not found",
        code: "NOT_FOUND",
        message: `Endpoint ${req.path} not found`,
      })
    })

    // Error handler
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error("[VaultSync] Server error:", err)
      res.status(500).json({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      })
    })

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`[VaultSync] Blind sync backend listening on port ${PORT}`)
    })

    // Graceful shutdown
    const shutdown = async () => {
      console.log("[VaultSync] Shutting down gracefully...")
      server.close(async () => {
        await closeDatabase()
        process.exit(0)
      })
    }

    process.on("SIGTERM", shutdown)
    process.on("SIGINT", shutdown)
  } catch (error) {
    console.error("[VaultSync] Failed to start server:", error)
    process.exit(1)
  }
}

start()
