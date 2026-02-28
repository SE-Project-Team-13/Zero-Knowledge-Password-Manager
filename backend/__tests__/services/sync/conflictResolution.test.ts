import { describe, it, expect } from "@jest/globals"
import mongoose from "mongoose"
import { VaultBlob } from "../../../src/database/models.js"
import { pushVault, resolveVaultConflict } from "../../../src/services/syncService.js"

describe("SyncService - Conflict Detection and Resolution", () => {
  it("detects conflict when server has newer timestamp than client base timestamp", async () => {
    const userId = new mongoose.Types.ObjectId().toString()

    await VaultBlob.create({
      userId,
      deviceId: "device-a",
      ciphertext: "server-newer",
      salt: "salt",
      iv: "iv",
      authTag: "tag",
      version: 2,
      timestamp: 2000,
      nonce: "nonce-server-newer",
    })

    const result = await pushVault(
      userId,
      "device-b",
      {
        ciphertext: "client-stale",
        salt: "salt",
        iv: "iv",
        authTag: "tag",
        version: 2,
        timestamp: 1500,
        nonce: "nonce-client-stale",
      },
      { baseTimestamp: 1000 },
    )

    expect(result.success).toBe(false)
    expect(result.conflict).toBeDefined()
    expect(result.conflict?.latestServerTimestamp).toBe(2000)
  })

  it("resolves conflict by overwriting with selected blob as latest version", async () => {
    const userId = new mongoose.Types.ObjectId().toString()

    await VaultBlob.create({
      userId,
      deviceId: "device-a",
      ciphertext: "server-old",
      salt: "salt",
      iv: "iv",
      authTag: "tag",
      version: 4,
      timestamp: 4000,
      nonce: "nonce-server-old",
    })

    const resolve = await resolveVaultConflict(
      userId,
      "device-b",
      {
        ciphertext: "chosen-local",
        salt: "salt",
        iv: "iv",
        authTag: "tag",
      },
      4000,
    )

    expect(resolve.success).toBe(true)
    expect(resolve.resolvedVersion).toBe(5)

    const latest = await VaultBlob.findOne({ userId }).sort({ timestamp: -1 })
    expect(latest?.ciphertext).toBe("chosen-local")
    expect(latest?.version).toBe(5)
  })
})
