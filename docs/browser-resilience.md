# Browser API resilience and static delivery

Every interactive API call has a 35-second AbortController deadline covering
session-refresh queueing, response headers and JSON body reading. This exceeds
the normal API's 25-second and proxy's 30-second deadlines. A timeout or network
failure produces a retryable `ApiError`; existing controller cleanup clears the
loading state and shows the error. Telemetry fallback requests also have a
35-second deadline and swallow reporting failures.

The browser never automatically retries a mutation. Before sending a body with
`command_id`, it retains the complete original envelope, including
`expected_version`, in memory and session storage. Network failures, timeouts,
unreadable success responses and retryable HTTP errors retain that envelope.
Repeating the same action reuses it, even after a page reload or a state refresh.
A different action on that resource is blocked until the uncertain action is
resolved. Confirmed success or a definitive non-retryable HTTP error clears it.
Cooperation requests are scoped to their case as well as the collection URL.
When browser storage is unavailable, the in-memory copy still protects retries
within the current page. No authentication tokens are written to browser storage.
Weekly operations also retain their original expected version: an already-applied
operation can return a stale-version response, which the controller handles by
loading the current attempt rather than resubmitting with a new version.

## Nginx and CDN policy

The game site sends an enforcing Content Security Policy on the document and
asset/API response locations, including locations with their own `add_header`
directives. Scripts and network calls use the same origin; embedded image/blob
textures and local blob workers are allowed for Babylon. Inline styles support
Svelte's generated styles and runtime layout. Inline scripts, eval, plugins,
framing and foreign form targets are blocked. Keep runtime asset dependencies
local when adding graphics features.

Only Vite filenames with generated content hashes and 3D URLs carrying a catalogue
content version receive one-year immutable caching. Unversioned public files
revalidate; index/SPA entry documents and API responses are not stored. Error
responses do not inherit a year-long immutable cache. Configure any CDN to respect
these headers, keep the `v` query parameter in its model cache key, and bypass
caching for `/api/` regardless of cookies or method. Do not apply a blanket
"cache everything" rule to the application. Preserve old hashed bundles during
rollout when existing tabs may still request lazy chunks from the prior release.

`make copy-code` excludes `web/asset-originals/`. Finder `.DS_Store` files have
been removed from public assets; the Vite build strips them from output and the
publish command excludes/removes them at the destination. Nginx also refuses to
serve them. Source maps remain outside the public document root.

No service worker is registered. HTTP/browser/CDN caching is the first mechanism
to tune. A future service worker must cache only a small versioned shell and
player-used packs, enforce byte/count limits with eviction, and leave API,
authentication and player state out of its caches. Require tested upgrade and
rollback behaviour across open old tabs and a new release, offline/missing chunks,
quota exhaustion, logout and cache eviction before enabling it. Do not precache
the entire model catalogue or activate an upgrade that mixes shell versions.

Verification: the web suite exercises stalled fetches/bodies, refresh ordering and
deadlines, command identity across reloads, ambiguous server failures, and actual
Nginx cache/CSP headers. The Nginx integration test skips only when the executable
is absent and uses a temporary local configuration without production TLS files.
