import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'Rock Paper Scissors - Multiplayer',
    description: 'Real-time multiplayer rock paper scissors game',
    icons: {
        icon: '/logo.jpg',
        apple: '/logo.jpg',
    },
}

import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import Script from 'next/script'

import GoogleAdsense from './components/GoogleAdsense'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <ClerkProvider appearance={{ baseTheme: dark }}>
            <html lang="en" suppressHydrationWarning>
                <head>
                    {/* Google Tag Manager */}
                    <Script id="gtm-script" strategy="afterInteractive">
                        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                        })(window,document,'script','dataLayer','GTM-NZBQWKGD');`}
                    </Script>
                    {/* End Google Tag Manager */}
                </head>
                <body suppressHydrationWarning>
                    {/* Google Tag Manager (noscript) */}
                    <noscript>
                        <iframe
                            src="https://www.googletagmanager.com/ns.html?id=GTM-NZBQWKGD"
                            height="0"
                            width="0"
                            style={{ display: 'none', visibility: 'hidden' }}
                        />
                    </noscript>
                    {/* End Google Tag Manager (noscript) */}
                    {children}
                    <GoogleAdsense />
                    <script src="https://checkout.bold.co/library/boldPaymentButton.js"></script>
                </body>
            </html>
        </ClerkProvider>
    )
}
