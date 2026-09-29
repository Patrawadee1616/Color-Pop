let coepCredentialless = false;
if (typeof window !== 'undefined') {
    coepCredentialless = window.crossOriginEmbedderPolicy === 'credentialless';
}

const windowOrWorker = typeof self !== 'undefined' ? self : window;

if (!windowOrWorker.coi) {
    windowOrWorker.coi = {
        shouldRegister: () => true,
        shouldDeregister: () => false,
        coepCredentialless: () => coepCredentialless,
        doReload: () => window.location.reload(),
        quiet: false
    };
}

if (typeof window !== 'undefined') {
    const n = navigator;
    if (n.serviceWorker && n.serviceWorker.controller) {
        n.serviceWorker.controller.postMessage({
            type: 'coi-ping',
        });
    }

    if (window.coi.shouldRegister()) {
        n.serviceWorker.register(window.document.currentScript.src).then(
            (registration) => {
                !window.coi.quiet && console.log('COOP/COEP Service Worker registered', registration.scope);

                registration.addEventListener('updatefound', () => {
                    !window.coi.quiet && console.log('Reloading page to make use of updated COOP/COEP Service Worker.');
                    window.coi.doReload();
                });

                if (registration.active && !n.serviceWorker.controller) {
                    !window.coi.quiet && console.log('Reloading page to make use of COOP/COEP Service Worker.');
                    window.coi.doReload();
                }
            },
            (err) => {
                !window.coi.quiet && console.error('COOP/COEP Service Worker failed to register:', err);
            }
        );
    }
} else {
    self.addEventListener('install', () => self.skipWaiting());
    self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'coi-ping') {
            event.source.postMessage({ type: 'coi-pong' });
        }
    });

    self.addEventListener('fetch', (event) => {
        const r = event.request;
        if (r.cache === 'only-if-cached' && r.mode !== 'same-origin') return;

        const request = coepCredentialless && r.mode === 'no-cors'
            ? new Request(r, { credentials: 'omit' })
            : r;

        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.status === 0) return response;

                    const newHeaders = new Headers(response.headers);
                    newHeaders.set('Cross-Origin-Embedder-Policy', coepCredentialless ? 'credentialless' : 'require-corp');
                    newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,
                    });
                })
                .catch((e) => console.error(e))
        );
    });
}
