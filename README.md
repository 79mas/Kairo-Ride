# Kairo Ride

![Kairo Ride icon](public/icon-192.png)

**Version 2.0.1**

A privacy-first, dark-themed Progressive Web App for electric unicycle riders. Track odometer history, individual rides, multi-day trips, wheels, gear, and original ride files from both phone and desktop.

Kairo Ride works offline, can sync directly to each user's Google Drive, and exports its database to Excel. It does not require an application backend for personal data.

## Features

| Area | What it does |
| --- | --- |
| Dashboard | Shows mileage summaries, wheel status, recent rides, and recent trips |
| Odometer | Stores real odometer readings and recalculates distances between them |
| Rides | Records individual outings or stages belonging to a longer trip |
| Trips | Groups rides and files into single-day or multi-day journeys |
| Garage | Manages multiple electric unicycles with independent odometer histories |
| Gear | Tracks helmets, footwear, protection, clothing, cameras, Cardo units, and other accessories |
| Attachments | Associates GPX, WheelLog, Komoot exports, photos, videos, and other original files with rides or trips |
| Data tools | Imports supported backups and exports JSON or a real `.xlsx` workbook |

The interface uses a fixed dark theme and is responsive on phones and desktop browsers. The included web app manifest, service worker, favicons, Apple touch icon, and maskable icons make it installable as a PWA.

## Privacy and storage model

- Changes are written to IndexedDB first, so the app remains usable when the connection is unavailable.
- Optional cloud sync writes directly to the signed-in user's Google Drive.
- GitHub Pages serves only the static application. It does not receive the user's ride database or attachments.
- Google access uses the limited `drive.file` scope. Kairo Ride can work with files it creates or files the user explicitly opens with the app; it does not request full Drive access.
- The OAuth access token stays in the active browser session. No `client_secret`, service account, Firebase project, or Apps Script deployment is required.
- Conflicting edits from different devices are shown to the user instead of being silently overwritten.

The app creates a `Kairo Ride` folder in Google Drive. Its main contents are:

- `database.json` — a convenient current database snapshot.
- `history/` — immutable operation records used for synchronization and recovery.
- `Kelionės/` — trip folders, including trip-level attachments and linked ride folders.
- `Pasivažinėjimai/` — folders for rides that do not belong to a trip.

Folder names include a date, title, and internal ID. Attachments are uploaded in their original format; Kairo Ride does not alter or interpret their contents.

## Deploy to GitHub Pages

### 1. Upload the project

1. Create a GitHub repository, for example `Kairo-Ride`.
2. Upload the **contents** of this package to the repository root. Do not upload the ZIP itself.
3. Include `.github/workflows/deploy.yml` and the other hidden files.
4. Do not commit personal Excel or JSON backups, GPX files, photos, videos, OAuth tokens, or client secrets.

### 2. Enable Pages

1. Open `Settings → Pages` in the repository.
2. Set `Source` to **GitHub Actions**.
3. Open `Actions → Publish Kairo Ride` and run the workflow for the `main` branch.
4. Wait for both the `build` and `deploy` jobs to complete.

The workflow detects the correct GitHub Pages base path automatically, so both a project URL such as `https://USERNAME.github.io/Kairo-Ride/` and a custom domain are supported.

At this point Kairo Ride works locally in the browser and can export backups. Complete the Google configuration below to sync devices and upload attachments.

For the original step-by-step owner guide in Lithuanian, see [GITHUB_PALEIDIMAS.md](GITHUB_PALEIDIMAS.md).

## Enable Google Drive sync

This configuration is performed once by the application owner. Regular users only select their Google account and approve access.

1. Create or select a project in Google Cloud Console.
2. Enable the **Google Drive API**.
3. Configure the OAuth consent screen for **Kairo Ride**. Use an external audience if personal Google accounts will sign in.
4. Add the scope `https://www.googleapis.com/auth/drive.file`.
5. Create an OAuth client with the **Web application** type.
6. Add the GitHub Pages origin under **Authorized JavaScript origins**. Use only the scheme and host, without the repository path. For `https://USERNAME.github.io/Kairo-Ride/`, enter `https://USERNAME.github.io`.
7. In the GitHub repository, open `Settings → Secrets and variables → Actions → Variables` and create `GOOGLE_CLIENT_ID` with the OAuth client ID as its value.
8. Run the `Publish Kairo Ride` workflow again.

The OAuth client ID is public configuration and may be included in the built app. Never add a Google client secret, service-account JSON, or access token to this repository.

Alternatively, set the public client ID in `public/kairo-config.json`:

```json
{
  "googleClientId": "YOUR_CLIENT_ID.apps.googleusercontent.com"
}
```

If both methods are used, the GitHub Actions variable takes precedence during the build.

When the Google OAuth app is in testing mode, each account must be added as a test user. Before inviting the public, complete the consent-screen requirements, adapt `public/privacy.html` with the project owner's real contact details, and move the OAuth app to production when appropriate.

## Install on a phone

Open the published HTTPS address once while online.

- **Android / Chrome:** use the in-app install action when offered, or open the browser menu and choose **Install app** or **Add to Home screen**.
- **iPhone / Safari:** choose **Share → Add to Home Screen**, enable **Open as Web App** if shown, and confirm.

Open Kairo Ride from the new home-screen icon. A browser and an installed PWA may use separate local storage in some environments, so complete Drive synchronization or export a backup before switching between them.

## Import and export

The data tools can export:

- A JSON backup containing the complete Kairo Ride operation history.
- An Excel workbook with `Wheels`, `Readings`, `Rides`, `Trips`, `Gear`, `Attachments`, `History`, and `KairoInfo` sheets.

The importer accepts Kairo Ride JSON and Excel backups, plus the supported legacy PWA workbook format containing `Rides` and `Models` sheets. Re-importing the same backup does not duplicate existing operations.

JSON and Excel backups contain attachment metadata and Drive links, **not the original GPX, photo, or video files**. Make sure original files have finished syncing to Drive or save them separately.

## Important limitations

- Version 2.0.1 is an early product build. The included automated suite passed, but real Google OAuth, the final GitHub Pages deployment, and physical-phone installation must still be verified with the owner's accounts and devices.
- A single attachment is limited to 512 MB. An imported backup is limited to 25 MB. The browser may impose a lower practical storage limit.
- Large uploads are not guaranteed to continue after the PWA is closed or suspended. Keep the app open until synchronization finishes.
- Google grants a temporary access token. When it expires, the user must explicitly refresh access; local records remain available.
- Uploaded originals currently remain in the local browser copy as well. Monitor device storage when attaching large videos.
- Removing an attachment reference from Kairo Ride does not delete the original file from Google Drive.
- The local database is not protected by a separate Kairo Ride password. Use a personal browser profile and an operating-system screen lock.
- Operation history grows over time. A very large long-term archive may eventually need history compaction and incremental cloud retrieval.
- Browser storage is isolated by origin and path. Moving the app to a different domain does not automatically move local data; export first or finish Drive sync.
- Kairo Ride stores files uploaded by the user, but it does not continuously synchronize WheelLog, Komoot, or other third-party accounts.

## Local development

Requirements: Node.js 22.13 or newer. Node.js 24 is recommended.

```bash
npm ci
npm run dev
```

Run all checks and create the static build:

```bash
npm run typecheck
npm run lint
npm test
```

Preview the generated site:

```bash
npm run preview
```

Test a GitHub project subpath locally:

```bash
KAIRO_BASE_PATH=/Kairo-Ride npm test
KAIRO_BASE_PATH=/Kairo-Ride npm run preview
```

The publishable static files are generated in `dist/client`. Do not serve the repository through `file://`; use Vite or an HTTPS host.

## Project structure

| Path | Purpose |
| --- | --- |
| `app/` | React entry point and global dark-theme styles |
| `components/kairo/` | Application screens, forms, and domain-facing UI |
| `components/ui/` | Reusable UI primitives |
| `lib/kairo/` | Domain model, operation history, IndexedDB, Drive, import, and Excel logic |
| `build/` | Versioned service-worker and PWA build integration |
| `public/` | Manifest, icons, public OAuth configuration, and privacy page |
| `tests/` | Automated domain, storage, export, Drive-protocol, UI, and static-PWA checks |
| `.github/workflows/deploy.yml` | TypeScript, automated test, and GitHub Pages deployment workflow |

## Release checklist

Before using Kairo Ride as the primary archive:

1. Add a test wheel, odometer reading, ride, trip, gear item, and small attachment.
2. Export both JSON and Excel and inspect the records.
3. Connect Google Drive, finish synchronization, and open the original attachment in Drive.
4. Sign in from a second device using the same site URL and Google account.
5. Install the PWA and test creating an offline record, then reconnect and sync.
6. Keep the previous database and original files until all migrated data has been verified.

## License

Kairo Ride is released under the [MIT License](LICENSE).
