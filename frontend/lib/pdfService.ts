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

    // Colors
    const primaryColor: [number, number, number] = [79, 70, 229] // Indigo
    const textColor: [number, number, number] = [31, 41, 55] // Gray-800
    const mutedColor: [number, number, number] = [107, 114, 128] // Gray-500
    const dangerColor: [number, number, number] = [220, 38, 38] // Red-600

    let y = 20

    // Header
    doc.setFillColor(...primaryColor)
    doc.rect(0, 0, pageWidth, 40, "F")

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.setFont("helvetica", "bold")
    doc.text("🔐 Emergency Kit", pageWidth / 2, 18, { align: "center" })

    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")
    doc.text("ZeroKnowledge Password Manager", pageWidth / 2, 30, { align: "center" })

    y = 55

    // Warning box
    doc.setFillColor(254, 243, 199) // Yellow-100
    doc.rect(15, y, pageWidth - 30, 35, "F")
    doc.setDrawColor(245, 158, 11) // Yellow-500
    doc.rect(15, y, pageWidth - 30, 35, "S")

    doc.setTextColor(...textColor)
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text("⚠️ IMPORTANT - STORE THIS SECURELY", 20, y + 10)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    const warningText = [
        "This document contains your Recovery Key. If you forget your master password,",
        "this is the ONLY way to recover your account. Store it in a secure location",
        "like a safe or safety deposit box. Do NOT store it digitally or share it."
    ]
    warningText.forEach((line, i) => {
        doc.text(line, 20, y + 18 + (i * 5))
    })

    y += 50

    // Account Information
    doc.setTextColor(...textColor)
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text("Account Information", 15, y)

    y += 10
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...mutedColor)
    doc.text("Email Address:", 15, y)
    doc.setTextColor(...textColor)
    doc.setFont("helvetica", "bold")
    doc.text(data.email, 55, y)

    y += 8
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...mutedColor)
    doc.text("Generated:", 15, y)
    doc.setTextColor(...textColor)
    doc.text(data.generatedAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }), 55, y)

    y += 20

    // Recovery Key Section
    doc.setFillColor(243, 244, 246) // Gray-100
    doc.rect(15, y, pageWidth - 30, 40, "F")
    doc.setDrawColor(...primaryColor)
    doc.setLineWidth(1)
    doc.rect(15, y, pageWidth - 30, 40, "S")

    y += 10
    doc.setTextColor(...primaryColor)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("🔑 Your Recovery Key", 20, y)

    y += 12
    doc.setTextColor(...textColor)
    doc.setFontSize(11)
    doc.setFont("courier", "bold")

    // Format key in groups for readability
    const keyParts = data.recoveryKey.match(/.{1,11}/g) || [data.recoveryKey]
    keyParts.forEach((part, i) => {
        doc.text(part, 20 + (i % 4) * 45, y + Math.floor(i / 4) * 8)
    })

    y += 35

    // Instructions Section
    doc.setTextColor(...textColor)
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text("How to Use This Recovery Key", 15, y)

    y += 10
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")

    const instructions = [
        "1. Go to the login page of ZeroKnowledge Password Manager",
        "2. Click on 'Forgot Password? Use Recovery Key'",
        "3. Enter your email address and this recovery key",
        "4. You will be prompted to set a new master password",
        "5. After resetting, generate a new Emergency Kit"
    ]

    instructions.forEach((instruction, i) => {
        doc.text(instruction, 20, y + (i * 7))
    })

    y += 45

    // Security Tips
    doc.setTextColor(...dangerColor)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("🛡️ Security Tips", 15, y)

    y += 8
    doc.setTextColor(...textColor)
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")

    const tips = [
        "• Print this document and store it in a fireproof safe",
        "• Give a copy to a trusted family member or attorney",
        "• Do NOT save this file on your computer or cloud storage",
        "• Do NOT take a photo with your phone",
        "• If this document is compromised, generate a new recovery key immediately"
    ]

    tips.forEach((tip, i) => {
        doc.text(tip, 20, y + (i * 6))
    })

    y += 40

    // Footer
    doc.setDrawColor(...mutedColor)
    doc.setLineWidth(0.5)
    doc.line(15, y, pageWidth - 15, y)

    y += 8
    doc.setTextColor(...mutedColor)
    doc.setFontSize(8)
    doc.text(
        "This document was generated by ZeroKnowledge Password Manager. We cannot recover your account without this key.",
        pageWidth / 2, y, { align: "center" }
    )

    // Save the PDF
    doc.save(`ZeroKnowledge-EmergencyKit-${data.email.split("@")[0]}.pdf`)
}

/**
 * Format a recovery key into readable groups.
 */
export function formatRecoveryKey(key: string): string {
    return key.match(/.{1,4}/g)?.join("-") || key
}
