# Achievement sharing

## Backend ownership

Achievements remain server-owned. `demoted` is inserted when a disciplinary
punishment changes the rank to a lower rank. `suspended` is inserted when the
disciplinary result jails a Rookie for 24 hours. The inserts occur in the same
MySQL transaction as the points, rank, jail and panel records, so a partial
result cannot be exposed.

The frontend reads:

```text
GET /v1/progression/summary
GET /v1/progression/achievement-catalog
```

It never submits an achievement. During a signed-in session it diffs the latest
summary against the preceding summary and queues a dialog for each new server
award. The first summary loaded after login establishes the baseline so old
awards do not all pop up again.

## Web behaviour

The same share dialog is opened in two ways:

1. automatically when a new award appears; or
2. by clicking an earned card on the Achievements page.

The dialog contains a visible card preview, generated PNG, achievement text and
the app link. It offers the operating system's share sheet where supported and
direct Facebook, X, WhatsApp, LinkedIn, Telegram, Reddit and Bluesky links. It
also offers copy and image-download fallbacks. Networks without a public web
composer, including Instagram, are reached through the native share sheet.

The share sheet requires HTTPS and a direct button press. The browser checks
`navigator.canShare({ files })` before attaching the PNG; if file sharing is not
supported it shares text and the link instead. No post is sent automatically,
and no sharing credential or social account data reaches the Naija Chase API.

## Verification

- A disciplinary rank loss adds `demoted` once.
- A Rookie suspension adds `suspended` once.
- A warning without rank loss or suspension adds neither.
- A newly observed award waits until a disciplinary panel closes.
- Closing one dialog reveals the next queued new award.
- Clicking any earned achievement opens the dialog every time.
- Locked achievements cannot be shared.
- All direct links are HTTPS and contain the app URL or achievement text.
