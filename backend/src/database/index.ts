import mongoose from "mongoose"

/**
 * Establishes a connection to the MongoDB database using the provided URI.
 * Logs success or terminates the process on failure.
 * @param uri - The MongoDB connection string.
 */
export async function connectToDatabase(uri: string) {
  try {
    await mongoose.connect(uri)
    console.log("[VaultSync] Connected to MongoDB Atlas successfully")
  } catch (error) {
    console.error("[VaultSync] MongoDB connection error:", error)
    process.exit(1)
  }
}

/**
 * Closes the active MongoDB connection.
 * Used during graceful shutdown of the server.
 */
export async function closeDatabase() {
  await mongoose.connection.close()
  console.log("[VaultSync] MongoDB connection closed")
}
