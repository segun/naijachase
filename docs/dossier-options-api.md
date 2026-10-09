# Dossier option catalogue — frontend handoff

The dossier editor must use the server-owned option catalogue instead of free
text. This keeps ordinary and weekly cases aligned with the thief profiles used
by the Rust engine and terminal game.

## Request

```http
GET /api/v1/dossier/options
Cookie: nc_session=<current session>
```

The browser client method is `api.dossierOptions()`. The endpoint requires a
valid session and returns `401` when the session has expired.

## Response

```json
{
  "catalogue_version": 1,
  "fields": [
    {
      "field": "vehicle",
      "label": "Vehicle",
      "options": [
        "a black motorcycle",
        "a blue minibus",
        "a dark luxury sedan",
        "a green sports car",
        "a grey hatchback",
        "a red convertible",
        "a silver saloon",
        "a vintage coupe",
        "a white pickup",
        "a yellow SUV"
      ]
    }
  ]
}
```

The real response contains all eight fields in dossier order. Options are
deduplicated and alphabetically sorted. They are derived from the canonical
thief profiles loaded by the API, so the frontend must not duplicate or
hard-code them.

## UI integration

1. Fetch once after login and retain the response in application state for the
   session.
2. Render one labelled select/listbox per returned field in both the ordinary
   dossier screen and weekly-challenge dossier screen.
3. Preselect the corresponding value from `state.dossier`, when present.
4. Submit the selected string unchanged through the existing
   `record_trait` command.
5. Disable submission until a listed value is selected. The API now rejects
   arbitrary dossier values, so typing or client-created alternatives cannot
   enter authoritative game state.

Both web dossier editors now consume this catalogue. The application loads it
after login or session restoration and discards it on sign-out. Loading failures
are shown inline with a retry button; there is no hard-coded/free-text fallback.
Unknown details remain unselected, and only changed listed values are submitted,
without trimming or rewriting the server strings. Previously recorded values
outside the current catalogue are displayed separately for correction rather
than turned into selectable alternatives.

The development mock serves a small canonical-value fixture at the same endpoint
and rejects unlisted values for both ordinary and weekly commands.

The formal response schema is
`schemas/api-dossier-options-v1.schema.json`; the TypeScript types are
`DossierOptions` and `DossierOptionField` in
`contracts/typescript/api-v1.ts`.
