export function getApiBaseUrl(): string {
  const prodDomain = "zero-knowledge-password-manager.onrender.com"
  
  // Check browser environment
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname
    
    // If we're not on the production domain, assume we're targeting a local/network backend
    if (hostname !== prodDomain && !hostname.endsWith(".onrender.com")) {
      // In development, the backend is usually on :3001
      return `${window.location.protocol}//${hostname}:3001`
    }
  }

  const isDev = process.env.NODE_ENV === "development"
  const defaultUrl = isDev 
    ? "http://localhost:3001" 
    : `https://${prodDomain}`
    
  const raw = process.env.NEXT_PUBLIC_API_URL || defaultUrl
  const withProtocol = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`
  return withProtocol.replace(/\/+$/, "")
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${getApiBaseUrl()}${normalizedPath}`
}

