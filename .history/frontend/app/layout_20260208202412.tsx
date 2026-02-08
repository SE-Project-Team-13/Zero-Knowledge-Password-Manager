import type { Metadata } from 'next'
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const outfit = Outfit({ subsets: ["latin"], variable: '--font-outfit' });
const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: '--font-jakarta' });

export const metadata: Metadata = {
  title: 'Secure Vault',
  description: 'Zero-Knowledge Password Manager',
  icons: {
    icon: [
      {
        url: '/favicon.svg',
        type: 'image/svg+xml',
      },
    ],
  },
}

import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/theme-provider"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.variable} ${plusJakarta.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" richColors closeButton duration={1500} />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
