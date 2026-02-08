import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    metadataBase: new URL('https://piedrapapel.com'),
    title: {
        default: 'Piedra Papel o Tijera - Gana Dinero Real a Nequi',
        template: '%s | Piedra Papel o Tijera'
    },
    description: 'Juega Piedra, Papel o Tijera online y gana dinero real transferido a Nequi. Participa en torneos, sube de rango y diviértete ganando. ¡Entra ya!',
    keywords: ['piedra papel', 'ganar dinero a nequi', 'ganar jugando annequi', 'cómo ganar dinero a nequi', 'juegos de habilidad', 'rock paper scissors', 'jugar online', 'dinero real', 'nequi'],
    authors: [{ name: 'Moddio' }],
    creator: 'Moddio',
    publisher: 'Moddio',
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
    openGraph: {
        type: 'website',
        locale: 'es_CO',
        url: 'https://piedrapapel.com',
        title: 'Piedra Papel o Tijera - Gana Dinero Real a Nequi',
        description: 'Demuestra tu habilidad en Piedra, Papel o Tijera y gana premios en efectivo directo a tu Nequi. ¡Juega ahora!',
        siteName: 'Piedra Papel o Tijera',
        images: [
            {
                url: '/logo.jpg',
                width: 800,
                height: 600,
                alt: 'Logo Piedra Papel o Tijera',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Piedra Papel o Tijera - Gana Dinero Real a Nequi',
        description: 'Juega y gana dinero real en Nequi. Torneos diarios y premios en efectivo.',
        images: ['/logo.jpg'],
        creator: '@Moddio',
    },
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
