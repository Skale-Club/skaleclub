# Skale NFC Provisioner

Desktop companion for **Smart Tags** (spec: Notion → *Smart Tags — Dynamic QR/NFC
Redirect & Analytics*, section 35). It programs and verifies the NFC chip of a
physical piece through a USB PC/SC reader. The Skale Club website stays the
system of record; this app holds no data of its own.

```
Website (tag page) ──"Send to provisioner"──► job { code, expected URL }
                                                   │  claimed by this app
Place tag ─► Program ─► write NDEF URI ─► read back ─► report
                                                   │
Website compares read-back == expected ──► chip "verified"  (or "failed")
Remove tag ─► next job
```

The chip always gets `https://skale.club/n/<public_code>` — never the customer
destination, a name or a database id. Changing where a tag points happens on
the website, never by rewriting the chip.

## Hardware

- Reader: ACR122U or any PC/SC NFC reader (SAM slots are ignored; keep only one
  reader connected).
- Tags: NFC Forum Type 2, NDEF-formatted — NTAG213 / NTAG215 / NTAG216.
- Drivers: Windows and macOS ship PC/SC. Linux needs `pcscd` running and
  `libpcsclite-dev` to build the native module (`sudo apt install pcscd libpcsclite-dev`).
  On Linux the kernel `pn533` driver may claim the ACR122U first; blacklist
  `pn533_usb`, `pn533` and `nfc` if the reader is not detected.

## Develop

```bash
cd nfc-provisioner
npm install          # also rebuilds the PC/SC native module for Electron
npm test             # NDEF / Type 2 / state machine, no hardware needed
npm start            # real reader
npm run simulate     # no hardware: simulated reader with a blank NTAG213
npm run dist         # installers via electron-builder → release/
```

`npm run simulate` with `SKALE_NFC_SERVER=http://localhost:1000` and
`SKALE_NFC_PAIRING_CODE=XXXX-XXXX` pairs automatically against a local site.

## Pairing and security

1. Website → Admin → **Smart Tags → Provisioners** → *Create pairing code*
   (single use, 10 minutes).
2. Type the code in the app. The app receives a **device token** that only works
   on `/api/provisioner/*` (claim jobs, report events/results). It is not an
   admin credential and no Supabase or service-role key ever ships in the app.
3. The token is encrypted at rest with the OS keychain (Electron `safeStorage`);
   the app refuses to store it if no OS encryption is available.
4. **Revoke** a computer from the same admin page: its token stops working at
   once and its open jobs are cancelled.

Electron hardening: `contextIsolation`, `sandbox`, no `nodeIntegration`, a
preload exposing eight named actions, IPC arguments validated in the main
process, strict CSP, navigation/new windows/permissions denied. The reader is
only touched from the main process.

## Protocol

HTTP + JSON, header `x-provisioner-protocol: 1`. A mismatch returns `426` and
the app shows *Update required*. The contract lives in
`shared/nfcProvisioning.ts` (website) and `src/api/client.ts` (app) — bump
`PROTOCOL_VERSION` in both on any breaking change.

| Call | Purpose |
| --- | --- |
| `POST /api/provisioner/pair` | pairing code → device token |
| `GET /api/provisioner/session` | token check, device name |
| `POST /api/provisioner/jobs/claim` | next job for this device (204 = none); resumes a job it already holds |
| `POST /api/provisioner/events` | audit/progress (`write_started` → writing, `write_completed` → verifying) |
| `POST /api/provisioner/jobs/:id/complete` | final result with the read-back URL; the server decides |

No offline mode: without the website the app does not write.

## Safety rules implemented

- A job is created from one specific tag page; the app shows that code large and
  asks the operator to match it with the printed piece.
- The NDEF length byte is written as 0 first and set last, so a tag lifted
  mid-write reads empty rather than as a truncated URL.
- Read-back must equal the expected URL exactly, checked by the app and again by
  the server.
- Problems found before writing (read-only, unformatted, too small, wrong reader
  count) keep the job open; failures during/after writing close it as failed.
- Final QA on the website: the tag page shows when a real phone NFC tap and a QR
  scan reached the tag after verification.

## Not in this version

- **Chip locking** is deliberately not implemented (spec allows shipping V1
  without it). Locking is irreversible and tag-specific; add it only after the
  write/verify flow has run on real hardware.
- Batch queue mode / auto-advance.
- Auto-update (the app reports its version; protocol mismatches are blocked).

## Repository

Lives in `Skale-Club/skaleclub` under `nfc-provisioner/` as an isolated package:
own `package.json`, never part of the website build or Docker image
(`.dockerignore`). To move it to its own repository with history:
`git subtree split --prefix nfc-provisioner -b nfc-provisioner`.
