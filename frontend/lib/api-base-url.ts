export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || "https://zero-knowledge-password-manager.onrender.com"
  const withProtocol = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`
  return withProtocol.replace(/\/+$/, "")
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${getApiBaseUrl()}${normalizedPath}`
}

