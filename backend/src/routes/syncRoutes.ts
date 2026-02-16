/**
 * Synchronization routes: push and pull vault data.
 */

import { Router, type Request, type Response } from "express"
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.js"
import { pushVault, pullVaults, getSyncMetadata } from "../services/syncService.js"
import type { SyncPushRequest, SyncPullRequest, SyncPullResponse, ErrorResponse } from "../types/index.js"

export function createSyncRouter(): Router {
  const router = Router()

  /**
   * POST /sync/push
   * Push encrypted vault to server.
   */
  router.post("/push", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, deviceId, vault } = req.body as SyncPushRequest
      const requestingUserId = req.userId

      if (userId !== requestingUserId) {
        return res.status(403).json({
          error: "Forbidden",
          code: "FORBIDDEN",
          message: "You can only push vaults for your own account",
        } as ErrorResponse)
      }

      const result = await pushVault(userId, deviceId, vault)

      if (!result.success) {
        return res.status(400).json({
          error: result.error,
          code: "PUSH_FAILED",
          message: result.error,
        } as ErrorResponse)
      }

      return res.status(201).json({
        vaultId: result.vaultId,
      })
    } catch (error) {
      console.error("[VaultSync] Push error:", error)
      return res.status(500).json({
        error: "Push failed",
        code: "INTERNAL_ERROR",
        message: "An error occurred during vault push",
      } as ErrorResponse)
    }
  })

  /**
   * POST /sync/pull
   * Pull encrypted vaults from server.
   */
  router.post("/pull", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, deviceId, lastVersion } = req.body as SyncPullRequest
      const requestingUserId = req.userId

      if (userId !== requestingUserId) {
        return res.status(403).json({
          error: "Forbidden",
          code: "FORBIDDEN",
          message: "You can only pull vaults for your own account",
        } as ErrorResponse)
      }

      const result = await pullVaults(userId, deviceId, lastVersion)

      if (!result.success) {
        return res.status(400).json({
          error: result.error,
          code: "PULL_FAILED",
          message: result.error,
        } as ErrorResponse)
      }

      const metadataResult = await getSyncMetadata(userId, deviceId)
      const currentVersion = metadataResult.metadata?.vaultVersion || 0
      const lastSyncTimestamp = metadataResult.metadata?.lastUpdated || Date.now()

      const response: SyncPullResponse = {
        vaults: result.vaults || [],
        lastSyncTimestamp,
        currentVersion,
      }

      return res.status(200).json(response)
    } catch (error) {
      console.error("[VaultSync] Pull error:", error)
      return res.status(500).json({
        error: "Pull failed",
        code: "INTERNAL_ERROR",
        message: "An error occurred during vault pull",
      } as ErrorResponse)
    }
  })

  return router
}
