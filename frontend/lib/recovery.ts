
import { generateEmergencyKitPDF } from "./pdfService"

/**
 * Generates a recovery key, encrypts the master password with it, 
 * activates it on the server, and downloads the Emergency Kit PDF.
 */
export async function generateAndDownloadRecoveryKey(
    email: string, 
    masterPassword: string, 
    token: string, 
    apiBaseUrl: string = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
): Promise<string> {
    // 1. Get a random key from the server
    const response = await fetch(`${apiBaseUrl}/recovery/generate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
    })

    if (!response.ok) {
        throw new Error("Failed to generate recovery key")
    }

    const data = await response.json()
    const { recoveryKey } = data

    // 2. Encrypt the current master password with this key
    // Derive wrapping key from recovery key (simple import since it's high entropy)
    const binaryKeyString = atob(recoveryKey)
    const keyBytes = new Uint8Array(binaryKeyString.length)
    for (let i = 0; i < binaryKeyString.length; i++) {
        keyBytes[i] = binaryKeyString.charCodeAt(i)
    }

    const wrappingKey = await window.crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
    )

    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    const encoder = new TextEncoder()
    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        wrappingKey,
        encoder.encode(masterPassword)
    )

    const encryptedVaultKey = JSON.stringify({
        iv: Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join(""),
        ciphertext: Array.from(new Uint8Array(encryptedBuffer)).map(b => b.toString(16).padStart(2, "0")).join("")
    })

    // 3. Hash the key for server authentication
    const keyData = encoder.encode(recoveryKey)
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", keyData)
    const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("")

    // 4. Activate the key on the server
    const activateResponse = await fetch(`${apiBaseUrl}/recovery/activate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
            email, 
            keyHash,
            encryptedVaultKey
        }),
    })

    if (!activateResponse.ok) {
        throw new Error("Failed to activate recovery key")
    }

    // 5. Generate and download PDF
    generateEmergencyKitPDF({
        email,
        recoveryKey,
        formattedKey: data.formattedKey || recoveryKey,
        generatedAt: new Date(),
    })
    
    return recoveryKey
}
