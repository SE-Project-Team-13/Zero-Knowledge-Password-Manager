import mongoose from "mongoose"

export async function connectToDatabase(uri: string) {
  try {
    await mongoose.connect(uri)
    console.log("[VaultSync] Connected to MongoDB Atlas successfully")
  } catch (error) {
    console.error("[VaultSync] MongoDB connection error:", error)
    process.exit(1)
  }
}

export async function closeDatabase() {
  await mongoose.connection.close()
  console.log("[VaultSync] MongoDB connection closed")
}
