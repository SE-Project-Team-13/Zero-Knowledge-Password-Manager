/**
 * PDF Service: Generate Emergency Kit PDF for users.
 * Contains recovery key, email, and safety instructions.
 */

import { jsPDF } from "jspdf"

interface EmergencyKitData {
    email: string
    recoveryKey: string
    formattedKey: string
    generatedAt: Date
}

/**
 * Generate an Emergency Kit PDF with recovery key and instructions.
 */
export function generateEmergencyKitPDF(data: EmergencyKitData): void {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15

    // Colors
    const accentColor: [number, number, number] = [79, 70, 229] // Indigo
    const textColor: [number, number, number] = [20, 20, 20] 
    const mutedColor: [number, number, number] = [100, 100, 100]
    const dangerColor: [number, number, number] = [180, 0, 0]

    let y = 0

    // Premium Header Bar (Compact)
    doc.setFillColor(...accentColor)
    doc.rect(0, 0, pageWidth, 32, "F")

    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(22)
    doc.text("EMERGENCY KIT", pageWidth / 2, 16, { align: "center" })

    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.text("ZeroKnowledge Vault - Secure Offline Recovery Access", pageWidth / 2, 24, { align: "center" })

    y = 40

    // Warning section
    doc.setFillColor(255, 251, 235) // Cream background
    doc.rect(margin, y, pageWidth - (margin * 2), 25, "F")
    doc.setDrawColor(252, 211, 77) // Gold border
    doc.setLineWidth(0.4)
    doc.rect(margin, y, pageWidth - (margin * 2), 25, "S")

    doc.setTextColor(180, 83, 9)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text("IMPORTANT: STORE THIS SECURELY", pageWidth / 2, y + 7, { align: "center" })

    doc.setTextColor(textColor[0], textColor[1], textColor[2])
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    const warningLines = [
        "This is the ONLY way to recover your vault if you forget your master password.",
        "Without it, your data is lost forever. Keep this in a physical safe."
    ]
    warningLines.forEach((line, i) => {
        doc.text(line, pageWidth / 2, y + 14 + (i * 5), { align: "center" })
    })

    y += 33

    // Account Information
    doc.setDrawColor(230, 230, 230)
    doc.line(margin, y, pageWidth - margin, y)
    y += 7

    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...textColor)
    doc.text("ACCOUNT INFORMATION", margin, y)

    y += 8
    doc.setFontSize(9)

    const details = [
        ["Email Address:", data.email],
        ["Generated on:", data.generatedAt.toLocaleString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })]
    ]

    details.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold")
        doc.setTextColor(...mutedColor)
        doc.text(label, margin, y)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(...textColor)
        doc.text(value, margin + 35, y)
        y += 6
    })

    y += 8

    // Recovery Key Box (Optimized for Copying)
    doc.setFillColor(250, 250, 255)
    doc.rect(margin, y, pageWidth - (margin * 2), 28, "F")
    doc.setDrawColor(...accentColor)
    doc.setLineWidth(0.7)
    doc.rect(margin, y, pageWidth - (margin * 2), 28, "S")

    doc.setTextColor(...accentColor)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.text("YOUR UNIQUE RECOVERY KEY", pageWidth / 2, y + 8, { align: "center" })

    y += 18
    doc.setFont("courier", "bold")
    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0)

    // Format the key to be clean without any dashes for perfect consistency
    const cleanKey = data.recoveryKey.replace(/[\s-]/g, '')
    doc.text(cleanKey, pageWidth / 2, y, { align: "center" })

    y += 20

    // Instructions Section
    doc.setTextColor(...textColor)
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text("HOW TO USE THIS KEY", margin, y)

    y += 7
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    const steps = [
        "1. Go to the ZeroKnowledge Vault login page.",
        "2. Click 'Forgot Password?' or 'Use Recovery Key'.",
        "3. Enter your email and the recovery key above (dashes are optional).",
        "4. Follow the prompts to verify and set a NEW master password.",
        "5. Immediately download a NEW Emergency Kit after successful recovery."
    ]
    steps.forEach((step, i) => {
        doc.text(step, margin, y + (i * 6))
    })

    y += 38

    // Security Guidelines
    doc.setTextColor(...dangerColor)
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text("SECURITY GUIDELINES", margin, y)

    y += 7
    doc.setTextColor(...textColor)
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    const tips = [
        "• PRINT THIS NOW: Digital files are vulnerable. Physical copies are much safer.",
        "• TRUSTED LOCATION: Store this in a safe and tell a trusted contact its location.",
        "• OFFLINE ONLY: Never save this in your cloud, email, or unencrypted local files.",
        "• RESET IF SHARED: If this key is exposed, generate a new one from your Settings."
    ]
    tips.forEach((tip, i) => {
        doc.text(tip, margin, y + (i * 5))
    })

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 8
    doc.setFontSize(7)
    doc.setTextColor(...mutedColor)
    doc.text(
        "ZeroKnowledge Vault - Zero-Knowledge Encryption. Your password is never sent to our servers.",
        pageWidth / 2, footerY, { align: "center" }
    )

    // Save
    const fileName = `ZeroKnowledge_Recovery_${data.email.replace(/[^a-z0-9]/gi, '_')}.pdf`
    doc.save(fileName)
}

/**
 * Format a recovery key - currently returns the raw key without dashes
 */
export function formatRecoveryKey(key: string): string {
    return key.replace(/[\s-]/g, "")
}

