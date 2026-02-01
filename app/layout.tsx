import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'Rock Paper Scissors - Multiplayer',
    description: 'Real-time multiplayer rock paper scissors game',
}

import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'

import GoogleAdsense from './components/GoogleAdsense'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <ClerkProvider appearance={{ baseTheme: dark }}>
            <html lang="en" suppressHydrationWarning>
                <body suppressHydrationWarning>
                    {children}
                    <GoogleAdsense />
                    <script src="https://checkout.bold.co/library/boldPaymentButton.js"></script>
                </body>
            </html>
        </ClerkProvider>
    )
}
