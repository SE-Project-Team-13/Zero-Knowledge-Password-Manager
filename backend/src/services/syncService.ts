import { VaultBlob, SyncMetadata } from "../database/models.js"
import type { VaultBlob as VaultBlobType } from "../types/index.js"
import mongoose from "mongoose"
import crypto from "crypto"

interface SyncMetadataPayload {
  userId: string
  deviceId: string
  lastUpdated: number
  vaultVersion: number
  nonce: string
}

interface IncomingVaultPayload {
  ciphertext: string
  salt: string
  iv: string
  authTag: string
  version: number
  timestamp: number
  nonce: string
}

interface ConflictPayload {
  latestServerBlob: VaultBlobType
  incomingBlob: IncomingVaultPayload
  latestServerTimestamp: number
}

/**
 * Pushes a new encrypted vault blob to the server.
 * Also updates the sync metadata for the device to track the latest version.
 */
export async function pushVault(
  userId: string,
  deviceId: string,
  vault: IncomingVaultPayload,
  options?: { baseTimestamp?: number; forceOverwrite?: boolean },
): Promise<{ success: boolean; vaultId?: string; error?: string; conflict?: ConflictPayload }> {
  try {
    const latest = await VaultBlob.findOne({ userId }).sort({ timestamp: -1 })
    if (!options?.forceOverwrite && options?.baseTimestamp !== undefined && latest) {
      const latestTimestamp = latest.timestamp || 0
      const hasDiverged = latestTimestamp > options.baseTimestamp && latest.ciphertext !== vault.ciphertext
      if (hasDiverged) {
        const latestServerBlob: VaultBlobType = {
          id: latest._id.toString(),
          userId: latest.userId.toString(),
          deviceId: latest.deviceId,
          ciphertext: latest.ciphertext,
          salt: latest.salt,
          iv: latest.iv,
          authTag: latest.authTag,
          version: latest.version,
          timestamp: latest.timestamp,
          nonce: latest.nonce,
          createdAt: latest.createdAt,
          updatedAt: latest.updatedAt,
        }
        return {
          success: false,
          error: "Conflict detected: server has a newer vault version",
          conflict: {
            latestServerBlob,
            incomingBlob: vault,
            latestServerTimestamp: latestTimestamp,
          },
        }
      }
    }

    const blob = new VaultBlob({
      userId,
      deviceId,
      ciphertext: vault.ciphertext,
      salt: vault.salt,
      iv: vault.iv,
      authTag: vault.authTag,
      version: vault.version,
      timestamp: vault.timestamp,
      nonce: vault.nonce,
    })

    await blob.save()
    await updateSyncMetadata(userId, deviceId, vault.version, vault.nonce)

    return { success: true, vaultId: blob._id.toString() }
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return { success: false, error: "Duplicate nonce - replay attack detected" }
    }
    const message = error instanceof Error ? error.message : "Unknown error"
    return { success: false, error: message }
  }
}

/**
 * Conflict resolution overwrite path.
 * Writes selected blob as a new canonical revision.
 */
export async function resolveVaultConflict(
  userId: string,
  deviceId: string,
  chosenBlob: {
    ciphertext: string
    salt: string
    iv: string
    authTag: string
  },
  expectedServerTimestamp?: number,
): Promise<{ success: boolean; vaultId?: string; resolvedVersion?: number; resolvedTimestamp?: number; error?: string; conflict?: ConflictPayload }> {
  try {
    const latest = await VaultBlob.findOne({ userId }).sort({ timestamp: -1 })
    if (!latest) {
      return { success: false, error: "No server blob exists to resolve against" }
    }

    if (expectedServerTimestamp !== undefined && latest.timestamp !== expectedServerTimestamp) {
      const latestServerBlob: VaultBlobType = {
        id: latest._id.toString(),
        userId: latest.userId.toString(),
        deviceId: latest.deviceId,
        ciphertext: latest.ciphertext,
        salt: latest.salt,
        iv: latest.iv,
        authTag: latest.authTag,
        version: latest.version,
        timestamp: latest.timestamp,
        nonce: latest.nonce,
        createdAt: latest.createdAt,
        updatedAt: latest.updatedAt,
      }
      return {
        success: false,
        error: "Conflict changed while resolving. Please resolve again.",
        conflict: {
          latestServerBlob,
          incomingBlob: {
            ...chosenBlob,
            version: latest.version,
            timestamp: latest.timestamp,
            nonce: latest.nonce,
          },
          latestServerTimestamp: latest.timestamp,
        },
      }
    }

    const nextVersion = (latest.version || 0) + 1
    const nextTimestamp = Date.now()
    const nextNonce = crypto.randomBytes(12).toString("hex")

    const result = await pushVault(
      userId,
      deviceId,
      {
        ...chosenBlob,
        version: nextVersion,
        timestamp: nextTimestamp,
        nonce: nextNonce,
      },
      { forceOverwrite: true },
    )

    if (!result.success) {
      return { success: false, error: result.error, conflict: result.conflict }
    }

    return {
      success: true,
      vaultId: result.vaultId,
      resolvedVersion: nextVersion,
      resolvedTimestamp: nextTimestamp,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { success: false, error: message }
  }
}

/**
 * Pulls vault blobs for a user, optionally filtering by version.
 */
export async function pullVaults(
  userId: string,
  deviceId: string,
  lastVersion?: number,
  lastTimestamp?: number,
): Promise<{ success: boolean; vaults?: VaultBlobType[]; error?: string }> {
  try {
    const filter: Record<string, any> = { userId }
    if (lastVersion !== undefined) {
      filter.version = { $gt: lastVersion }
    }
    if (lastTimestamp !== undefined) {
      filter.timestamp = { $gt: lastTimestamp }
    }

    const rows = await VaultBlob.find(filter).sort({ version: -1 })

    const vaults: VaultBlobType[] = rows.map((row) => ({
      id: row._id.toString(),
      userId: row.userId.toString(),
      deviceId: row.deviceId,
      ciphertext: row.ciphertext,
      salt: row.salt,
      iv: row.iv,
      authTag: row.authTag,
      version: row.version,
      timestamp: row.timestamp,
      nonce: row.nonce,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))

    return { success: true, vaults }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { success: false, error: message }
  }
}

/**
 * Pulls the latest blob only if it's newer than the client's last-known timestamp.
 */
export async function pullLatestBlobIfNewer(
  userId: string,
  lastKnownTimestamp?: number,
): Promise<{ success: boolean; hasUpdate?: boolean; blob?: VaultBlobType; serverTimestamp?: number; error?: string }> {
  try {
    const latest = await VaultBlob.findOne({ userId }).sort({ timestamp: -1 })
    if (!latest) {
      return { success: true, hasUpdate: false, serverTimestamp: 0 }
    }

    const latestTimestamp = latest.timestamp || 0
    if (lastKnownTimestamp !== undefined && latestTimestamp <= lastKnownTimestamp) {
      return { success: true, hasUpdate: false, serverTimestamp: latestTimestamp }
    }

    const blob: VaultBlobType = {
      id: latest._id.toString(),
      userId: latest.userId.toString(),
      deviceId: latest.deviceId,
      ciphertext: latest.ciphertext,
      salt: latest.salt,
      iv: latest.iv,
      authTag: latest.authTag,
      version: latest.version,
      timestamp: latest.timestamp,
      nonce: latest.nonce,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
    }

    return { success: true, hasUpdate: true, blob, serverTimestamp: latestTimestamp }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { success: false, error: message }
  }
}

async function updateSyncMetadata(
  userId: string,
  deviceId: string,
  vaultVersion: number,
  nonce: string,
): Promise<void> {
  const now = Date.now()

  await SyncMetadata.findOneAndUpdate(
    { userId, deviceId },
    {
      lastUpdated: now,
      vaultVersion,
      nonce,
      updatedAt: new Date(now),
    },
    { upsert: true },
  )
}

export async function getSyncMetadata(
  userId: string,
  deviceId: string,
): Promise<{ success: boolean; metadata?: SyncMetadataPayload | null; error?: string }> {
  try {
    const metadata = await SyncMetadata.findOne({ userId, deviceId })

    if (!metadata) {
      return { success: true, metadata: null }
    }

    return {
      success: true,
      metadata: {
        userId: metadata.userId.toString(),
        deviceId: metadata.deviceId,
        lastUpdated: metadata.lastUpdated,
        vaultVersion: metadata.vaultVersion,
        nonce: metadata.nonce,
      },
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { success: false, error: message }
  }
}
