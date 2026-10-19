# Mobile fullscreen and Home Screen installation

Naija Chase gives phone and tablet players two browser-safe ways to reclaim the
space normally occupied by browser controls:

- **Full screen** calls the standard Fullscreen API from the player's tap. Android
  browsers that support the API hide their navigation UI. The control becomes an
  Exit button while fullscreen is active and returns after a browser or orientation
  change exits fullscreen.
- **Install app** uses Chromium's saved `beforeinstallprompt` event when it is
  available. Otherwise it shows short platform instructions. Safari on iPhone and
  iPad directs players to **Share → Add to Home Screen**; another iOS browser first
  directs them to Safari because iOS does not expose the install event there.

The controls appear only on mobile-sized or coarse-pointer devices and disappear
when the game is already running in installed `standalone` or `fullscreen` mode.
They are offered in portrait and landscape. Browsers never receive an automatic
fullscreen request: that is forbidden without a player gesture.

`public/manifest.webmanifest` requests an unrestricted orientation and a fullscreen
installed experience, with standalone/minimal fallbacks. The page also includes
Apple standalone metadata and a 180-pixel touch icon. The 192- and 512-pixel
manifest icons are maskable. CSS retains `100vh` as a compatibility fallback and
then uses `100dvh`, plus safe-area insets, so either browser mode uses the currently
visible screen without hiding controls behind a notch or Home indicator.

This deliberately does not introduce a service worker. The existing production
policy relies on HTTP/CDN caching and requires a separately designed, bounded and
tested upgrade strategy before adding offline caches.

## Verification

Run `pnpm test` and `pnpm build` from `web/`. Before release, verify on physical
current iPhone/Safari and Android/Chrome devices in both orientations:

1. The Full screen button works where supported and its Exit state follows the
   browser.
2. iPhone instructions lead to a Home Screen icon and that icon launches without
   Safari's address and bottom bars.
3. Android's native install sheet opens after installability becomes available;
   the menu instructions remain useful before that event.
4. Installed launches hide the two promotion controls and retain reachable game,
   music and detail controls around every safe area.
