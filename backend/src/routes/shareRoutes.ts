import { Router, type Response } from "express"
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.js"
import { SharedCredential, User } from "../database/models.js"

export function createShareRouter(): Router {
  const router = Router()

  router.post("/public-key", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { publicKey, signingPublicKey } = req.body as {
        publicKey?: string
        signingPublicKey?: string
      }
      if (!publicKey || !signingPublicKey) {
        return res.status(400).json({ error: "Missing sharing keys" })
      }
      await User.findByIdAndUpdate(req.userId, {
        sharePublicKey: publicKey,
        shareSigningPublicKey: signingPublicKey,
      })
      return res.status(200).json({ success: true })
    } catch (error) {
      console.error("[Share] public-key upsert error", error)
      return res.status(500).json({ error: "Failed to save public key" })
    }
  })

  router.get("/public-key/:email", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = decodeURIComponent(req.params.email || "").trim().toLowerCase()
      if (!email) {
        return res.status(400).json({ error: "Missing recipient email" })
      }
      const user = await User.findOne({ email }).select("_id email fullName sharePublicKey shareSigningPublicKey")
      if (!user || !user.sharePublicKey || !user.shareSigningPublicKey) {
        return res.status(404).json({ error: "Recipient has not enabled secure sharing" })
      }
      return res.status(200).json({
        userId: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        publicKey: user.sharePublicKey,
        signingPublicKey: user.shareSigningPublicKey,
      })
    } catch (error) {
      console.error("[Share] public-key lookup error", error)
      return res.status(500).json({ error: "Failed to fetch recipient public key" })
    }
  })

  router.post("/send", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { recipientEmail, encryptedSessionKey, ciphertext, iv, signature, senderSigningPublicKey, credentialLabel } = req.body as {
        recipientEmail?: string
        encryptedSessionKey?: string
        ciphertext?: string
        iv?: string
        signature?: string
        senderSigningPublicKey?: string
        credentialLabel?: string
      }
      if (!recipientEmail || !encryptedSessionKey || !ciphertext || !iv || !signature || !senderSigningPublicKey) {
        return res.status(400).json({ error: "Invalid share payload" })
      }

      const senderUserId = req.userId
      const normalizedRecipientEmail = recipientEmail.trim().toLowerCase()
      const sender = await User.findById(senderUserId).select("shareSigningPublicKey")
      if (!sender?.shareSigningPublicKey) {
        return res.status(400).json({ error: "Sender sharing identity is not initialized" })
      }
      if (sender.shareSigningPublicKey !== senderSigningPublicKey) {
        return res.status(400).json({ error: "Invalid sender signing key" })
      }
      const recipient = await User.findOne({ email: normalizedRecipientEmail }).select("_id")
      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" })
      }
      if (recipient._id.toString() === senderUserId) {
        return res.status(400).json({ error: "Cannot share with yourself" })
      }

      const share = await SharedCredential.create({
        senderUserId,
        recipientUserId: recipient._id,
        recipientEmail: normalizedRecipientEmail,
        encryptedSessionKey,
        ciphertext,
        iv,
        signature,
        senderSigningPublicKey,
        credentialLabel: credentialLabel || undefined,
        status: "pending",
      })
      return res.status(201).json({ success: true, shareId: share._id.toString() })
    } catch (error) {
      console.error("[Share] send error", error)
      return res.status(500).json({ error: "Failed to create share" })
    }
  })

  router.get("/incoming", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const recipientUserId = req.userId
      const shares = await SharedCredential.find({
        recipientUserId,
        status: "pending",
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate("senderUserId", "email fullName")

      return res.status(200).json({
        shares: shares.map((share) => ({
          id: share._id.toString(),
          encryptedSessionKey: share.encryptedSessionKey,
          ciphertext: share.ciphertext,
          iv: share.iv,
          signature: share.signature,
          senderSigningPublicKey: share.senderSigningPublicKey,
          recipientEmail: share.recipientEmail,
          sender: {
            userId: (share.senderUserId as any)?._id?.toString?.() || "",
            email: (share.senderUserId as any)?.email || "",
            fullName: (share.senderUserId as any)?.fullName || "",
          },
          createdAt: share.createdAt,
          credentialLabel: share.credentialLabel || null,
        })),
      })
    } catch (error) {
      console.error("[Share] incoming error", error)
      return res.status(500).json({ error: "Failed to fetch incoming shares" })
    }
  })

  router.post("/:shareId/accept", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { shareId } = req.params
      const recipientUserId = req.userId
      const updated = await SharedCredential.findOneAndUpdate(
        { _id: shareId, recipientUserId, status: "pending" },
        {
          status: "accepted",
          acceptedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
          updatedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
        },
        { new: true },
      )
      if (!updated) {
        return res.status(404).json({ error: "Share not found or already processed" })
      }
      return res.status(200).json({ success: true })
    } catch (error) {
      console.error("[Share] accept error", error)
      return res.status(500).json({ error: "Failed to accept share" })
    }
  })

  router.post("/:shareId/reject", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { shareId } = req.params
      const recipientUserId = req.userId
      const updated = await SharedCredential.findOneAndUpdate(
        { _id: shareId, recipientUserId, status: "pending" },
        {
          status: "rejected",
          updatedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
        },
        { new: true },
      )
      if (!updated) {
        return res.status(404).json({ error: "Share not found or already processed" })
      }
      return res.status(200).json({ success: true })
    } catch (error) {
      console.error("[Share] reject error", error)
      return res.status(500).json({ error: "Failed to reject share" })
    }
  })

  return router
}
