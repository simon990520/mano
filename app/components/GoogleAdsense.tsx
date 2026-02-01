'use client';

import Script from 'next/script';

export default function GoogleAdsense() {
    return (
        <>
            <Script
                id="admob-sdk"
                src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2148261210607684"
                strategy="afterInteractive"
                data-adtest="on"
                crossOrigin="anonymous"
                onLoad={() => {
                    console.log('[ADMOB_SDK] Loaded successfully');
                    // @ts-ignore
                    window.admobStatus = 'loaded';
                }}
                onError={(e) => {
                    console.error('AdMob SDK failed to load (Likely AdBlock)', e);
                    // @ts-ignore
                    window.admobStatus = 'error';
                }}
            />
            <Script id="admob-config" strategy="afterInteractive">
                {`
                    window.adsbygoogle = window.adsbygoogle || [];
                    window.adBreak = window.adBreak || function(o) { 
                        console.log('[ADMOB_WRAPPER] Pushing to adsbygoogle:', o);
                        window.adsbygoogle.push(o); 
                    };
                    window.adsbygoogle.push({
                        preloadAdBreaks: 'on',
                        onReady: () => { console.log('[ADMOB_SDK] SDK is ready'); }
                    });
                `}
            </Script>
        </>
    );
}
