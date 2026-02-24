/**
 * Synchronization routes: push and pull vault data.
 */

import { Router, type Request, type Response } from "express"
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.js"
import { pushVault, pullVaults, getSyncMetadata, pullLatestBlobIfNewer } from "../services/syncService.js"
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
      const { userId, deviceId, lastVersion, lastTimestamp } = req.body as SyncPullRequest
      const requestingUserId = req.userId

      if (userId !== requestingUserId) {
        return res.status(403).json({
          error: "Forbidden",
          code: "FORBIDDEN",
          message: "You can only pull vaults for your own account",
        } as ErrorResponse)
      }

      const result = await pullVaults(userId, deviceId, lastVersion, lastTimestamp)

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

  /**
   * POST /sync/blob/push
   * Mailbox-style endpoint: accepts encrypted blob as-is.
   */
  router.post("/blob/push", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, deviceId, blob } = req.body as any
      const requestingUserId = req.userId

      if (userId !== requestingUserId) {
        return res.status(403).json({
          error: "Forbidden",
          code: "FORBIDDEN",
          message: "You can only push blobs for your own account",
        } as ErrorResponse)
      }

      const result = await pushVault(userId, deviceId, {
        ciphertext: blob.ciphertext,
        salt: blob.salt,
        iv: blob.iv,
        authTag: blob.authTag,
        version: blob.version,
        timestamp: blob.timestamp,
        nonce: blob.nonce,
      })

      if (!result.success) {
        return res.status(400).json({
          error: result.error,
          code: "BLOB_PUSH_FAILED",
          message: result.error,
        } as ErrorResponse)
      }

      return res.status(201).json({ blobId: result.vaultId })
    } catch (error) {
      console.error("[VaultSync] Blob push error:", error)
      return res.status(500).json({
        error: "Blob push failed",
        code: "INTERNAL_ERROR",
        message: "An error occurred during blob push",
      } as ErrorResponse)
    }
  })

  /**
   * POST /sync/blob/pull
   * Mailbox-style endpoint: returns latest blob only if newer than client's timestamp.
   */
  router.post("/blob/pull", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, lastKnownTimestamp } = req.body as any
      const requestingUserId = req.userId

      if (userId !== requestingUserId) {
        return res.status(403).json({
          error: "Forbidden",
          code: "FORBIDDEN",
          message: "You can only pull blobs for your own account",
        } as ErrorResponse)
      }

      const result = await pullLatestBlobIfNewer(userId, lastKnownTimestamp)
      if (!result.success) {
        return res.status(400).json({
          error: result.error,
          code: "BLOB_PULL_FAILED",
          message: result.error,
        } as ErrorResponse)
      }

      return res.status(200).json({
        hasUpdate: result.hasUpdate || false,
        serverTimestamp: result.serverTimestamp || 0,
        blob: result.blob || null,
      })
    } catch (error) {
      console.error("[VaultSync] Blob pull error:", error)
      return res.status(500).json({
        error: "Blob pull failed",
        code: "INTERNAL_ERROR",
        message: "An error occurred during blob pull",
      } as ErrorResponse)
    }
  })

  return router
}
