# Kairo Ride

![Kairo Ride icon](public/icon-192.png)

**Version 2.0.7 · clearer settings, trip files, editable goals and safe archiving**

A privacy-first, English-first Progressive Web App for electric unicycle riders. Track odometer history, individual rides, multi-day trips, vehicles, gear, maintenance, insurance and original trip files from both phone and desktop.

Kairo Ride works offline, can sync directly to each user's Google Drive, and exports its database to Excel. It does not require an application backend for personal data.

## Features

| Area | What it does |
| --- | --- |
| Dashboard | Last ride / last trip; long-term km/day, km/week or km/month averages; Fleet cards; and a swipeable daily chart with interactive vehicle toggles |
| Rides | Optional names, required odometer, live distance calculation, remembered vehicle; sortable phone/desktop table with top scrolling and estimated km/d |
| Trips | Groups rides and files into single-day or multi-day journeys |
| Garage | Manages multiple electric unicycles, their status, maintenance reminders and independent odometer histories |
| Maintenance | 20 inspection, condition-based work, insurance and custom templates; editable date / odometer autofill, independent reminder checkboxes and recurring checks |
| Gear | Collapsible item cards for helmets, footwear, cameras, Cardo and accessories, with “Used with” relationships |
| Analytics | Draggable/zoomable cumulative and grouped bar charts; visible-series autoscale; custom total/vehicle goals with 30-day-average forecasts |
| Settings | English/Lithuanian, date format, week start, reminders, Drive sync, backups and installation |
| Attachments | Associates GPX, WheelLog, Komoot exports, photos, videos, and other original files with trips |
| Data tools | Imports supported backups and exports JSON or a real `.xlsx` workbook |

The interface uses a fixed black/orange theme with `#f16305` as the primary colour and is responsive on phones and desktop browsers. English is the default language; Lithuanian can be selected in Settings. The included web app manifest, service worker, favicons, Apple touch icon, and maskable icons make it installable as a PWA.

## New in 2.0.7

- **Settings:** four groups — Appearance & regional settings, Synchronization, Import / Export, Information. Draft settings apply with Apply; Cancel discards the draft. Account, import/export and storage actions are immediate.
- **Hero:** Last ride is the default. Last trip shows the complete latest trip distance. All existing long-term average options remain.
- **Goals:** optional names, editable scope and targets, current week/month/year, all time or custom dates. Select a goal for the full-width global progress bar. Default: Around the Earth (all vehicles, all time) — 40 075 km.
- **Rides / Trips:** vehicle filters and detail dialogs. Trips use a sortable table; only Trips accept original files. Existing ride attachments automatically migrate into their linked trip, or a dedicated trip, without losing originals.
- **Garage / Maintenance:** collapsible cards. Fleet opens the corresponding Garage card. Maintenance adds a monthly calendar and a remaining-distance indicator using the relevant vehicle's odometer.
- **Gear:** name, category and status sorts each support both directions.
- **Deletion:** available only from editing, followed by confirmation. Items are archived, history and original files are retained, and archived items cannot receive new associations. Removed vehicles retain historical mileage. Removed erroneous ride/odometer records are excluded from active calculations; remaining odometer intervals are recalculated.
- **Charts:** quiet focus/selection, grouped bars retained; Home labels are Week / Month.

**Upgrade all devices to 2.0.7 before continuing work.** Earlier strict validators do not recognize the added fields. Export a backup first, finish pending uploads, close older app windows, and confirm 2.0.7 on phone and desktop. Do not clear browser storage or reimport existing data.

## Goal calculations

Targets refer to your **tracked distance**, not the vehicle's absolute odometer at purchase.

```text
30-day average = distance attributed to the last 30 calendar days / 30
days remaining = ceiling((target km - current tracked km) / 30-day average)
estimated date = today + days remaining
```

The window includes today and days with zero distance. For a sparse odometer journal, each interval is distributed evenly over the days after the previous odometer date through the new record date; same-day records count on that day. For example, 70 km across seven days contributes an estimated 10 km/day. Legacy distance-only rides count on their recorded day. This is a planning estimate, not measured daily activity; no riding is inferred after the last record.

The date is not predicted without recent distance, for inconsistent/incomplete history, or for a selected inactive vehicle. A reached goal is labelled as reached. Future-dated records are excluded from the goal's current distance and rolling average. Goal scope is independent of the chart legend.

**Compatibility:** update every phone/computer window to **2.0.7 before saving changed settings, goals or archived items**. Older strict validators do not understand the new goal kind or empty ride names. Old operations are not rewritten; database names, record IDs, Google access and existing files stay unchanged.

## Added in 2.0.5

- User-facing odometer terminology is **record / records**, including the Excel **Records** report sheet.
- The Hero has a second horizontal divider, with **All vehicles** or the selected vehicle between the two lines. This label applies to the four secondary totals. The top km/d, km/w or km/m average still covers all vehicles and all time.
- Garage displays an editable status badge for every vehicle. Expand the card, edit the vehicle and use **Vehicle status**.
- Settings includes **Feedback & suggestions** with a direct email link.

| Vehicle status | New records | Existing archive |
| --- | --- | --- |
| Active | Allowed | Kept |
| Active! | Allowed, with a maintenance popup | Kept |
| Critical | Blocked | Kept and editable |
| In repair | Blocked | Kept and editable |
| Spare | Allowed | Kept |
| Sold | Blocked | Kept and editable |

An Active or Spare vehicle automatically displays **Active!** when one of its maintenance tasks is due, overdue, or within its configured date-reminder window. Completion or rescheduling clears this automatic flag back to the saved status. Future tasks alone do not flag the vehicle.

You can also select **Active!** manually. Add a short maintenance reminder, or link an unfinished maintenance task to the vehicle. The popup lists the actual tasks, their date / odometer targets and the manual note. A manually selected flag stays until you change the status; it is not cleared automatically.

The popup appears on every Garage visit and whenever you start a new record with, or select, the affected vehicle. It is separate from optional OS notifications and does not need notification permission. It can be dismissed and times out after 15 seconds. Critical, In repair and Sold are never automatically reactivated by maintenance.

All vehicles remain in Fleet, statistics, filters and historical rides. You may edit an existing archived record or add ride details to a legacy record, but cannot create a new record or move a record onto a different inactive vehicle. Historical imports, sync and recovery still work. Reactivate a vehicle in Garage when it is ready for new records. Offline devices only know the status they last synchronized.

The internal history key `reading` is intentionally unchanged to preserve old backups and operation IDs. Older Excel exports with a `Readings` report sheet still import. The Wheels export includes current status, saved status and manual reminder text; History remains the authoritative recovery data. Status fields were introduced in 2.0.5; update all devices to the current **2.0.7** release to use statuses, unnamed rides and goals together.

## Privacy and storage model

- Changes are written to IndexedDB first, so the app remains usable when the connection is unavailable.
- Optional cloud sync writes directly to the signed-in user's Google Drive.
- GitHub Pages serves only the static application. It does not receive the user's ride database or attachments.
- Google access uses the limited `drive.file` scope. Kairo Ride can work with files it creates or files the user explicitly opens with the app; it does not request full Drive access.
- The OAuth access token stays only in the open window's memory, not persistent browser storage. No `client_secret`, service account, Firebase project, or Apps Script deployment is required.
- Conflicting edits from different devices are shown to the user instead of being silently overwritten.

The app creates a `Kairo Ride` folder in Google Drive. Its main contents are:

- `database.json` — a convenient current database snapshot.
- `history/` — immutable operation records used for synchronization and recovery.
- `Trips/` — trip folders, including trip-level attachments and linked ride folders.
- `Rides/` — folders for rides that do not belong to a trip.

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

## Automatic synchronization (2.0.4)

After connecting Google Drive, **Automatic sync** is enabled by default in Settings. This is a per-device preference; **Sync now** remains available.

- Saved local changes are batched for about 1.5 seconds, then uploaded.
- The active, visible app checks Drive every 60 seconds even when it has no local changes, so edits from another device can arrive automatically.
- Returning to the app or reconnecting to the internet triggers another check. Only one sync runs at a time in the window; supported browsers also serialize sync between tabs using Web Locks.
- Temporary network failures, rate limits and server failures retry with increasing delays (5 seconds up to 5 minutes). Permission, quota and history-integrity errors pause automatic retries and show an explanation.
- The app does not rewrite `database.json` or traverse every attachment folder on every unchanged poll. Immutable `history/` records remain the synchronization source of truth.
- Concurrent edits preserve both revisions for review. Automatic sync cannot prevent two offline devices editing the same record, but it does not silently replace the losing edit with a whole-database upload.

Both devices need to run the app with valid access at some point for changes to arrive. They do not have to be open simultaneously: the first device uploads to Drive, and the second retrieves changes when active. Uploading files uses the user's network connection and Drive quota; disable Automatic sync in Settings if needed.

Automatic synchronization is **not automatic Google reauthorization**. The access token stays only in memory. Reloading the app or token expiry requires the user to press **Refresh access**. The app never opens sign-in popups from a background timer. Background/closed mobile apps are not guaranteed to keep running. [Google's browser token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model).

## Understanding the km/d estimate

The Rides table calculates `distance / calendar days since the previous entry for that vehicle`. Odometer-derived distances use the previous **odometer** date, because the odometer delta covers that entire interval. The first interval starts at the vehicle's baseline date. Same-day intervals use one day; unknown distances remain blank.

For example, 70 km over 7 days is **10 km/d**. This is an estimate for irregular record keeping, not a measured ride duration or average speed. Click the `km/d` heading for highest first, then click again for lowest first. `Distance · km` sorts the recorded distance instead; Notes sorts by note length, with populated/longest notes first. The sort selector also works on phones.

On phones, optional columns that contain no information are hidden. Zero, missing and dash-only cell content is hidden; the remaining cells retain their table alignment. The date column and column headings stay pinned inside a height-limited scroll area, and the top slider/arrow buttons move through columns without scrolling to the last record.

## Maintenance templates (additional 2.0.4 update)

Open **Garage → Maintenance → Add task**:

1. Choose a task type and vehicle. The name, suggested date and absolute odometer target fill automatically. The date starts from the day the form was opened; mileage starts from that vehicle's latest saved record (or its baseline if it has no records). Update Rides first if its odometer is stale.
2. Use the separate **Date** and **Mileage** checkboxes. Enable either or both; when both are enabled, the first threshold reached triggers attention. Both targets remain editable. Saved targets do not keep moving forward when new rides arrive.
3. Optionally change the advance notice in days. Inspection templates start with zero days' advance notice to avoid a new weekly check being immediately due; insurance starts with 14 days.
4. Periodic templates can **Schedule the next check when completed**. Edit the repeat distance and time (days or calendar months), or disable repetition. The completed record and its successor are saved together in one history operation.
5. Record findings in **Notes / actual condition**, then save. To complete an existing task, edit it and tick **Mark as completed**. The next inspection uses the completion date and the latest recorded odometer, not an old overdue target. Update the odometer first when needed. Explicitly recurring insurance instead retains the entered policy-expiry anchor; always verify the renewed policy's actual expiry.

For example, starting on **2026-08-30** at **1,346 km**, **Check tire pressure** suggests **2026-09-06** and **1,446 km**, repeating after 7 days or 100 km. These are suggested inspection intervals, not a pressure recommendation.

The 20 templates include safety, pressure, tread/sidewalls/valve, rim, pedals, initial and regular fastener checks, bearings, suspension cleaning and function, charging connections, battery/BMS review, professional inspection, five condition/component-based tasks, insurance and custom work. Ranges use their lower end as an editable default. The initial fastener check is a one-off break-in check; afterwards add the regular fastener template.

**These are user-suggested starting reminders, not an official Lynx-S or other manufacturer's service schedule.** Vehicle and component instructions take priority. Condition, water, dirt, impacts and unusual symptoms may require an earlier inspection. The professional-inspection template uses the general annual / 1,000–2,000 km guidance from [Voltride](https://voltride.com/electric-unicycle-maintenance-what-you-can-do-yourself-to-keep-your-wheel-in-good-condition/); the rest of the catalog is not attributed to Voltride or to a manufacturer.

No mileage or date is invented for condition-based replacement, suspension-component service, checks before each ride/charge, or insurance expiry. Such checklists have no timed alert unless you enable and fill a manual reminder. Physical condition, charging and individual ride starts are not detected automatically. Insurance requires the actual expiry date from the policy.

Enable optional system alerts in **Settings → Appearance & regional settings → Maintenance reminders → Enable local reminders**. In-app status remains available without notification permission. Date changes are checked while active even without Drive; system alerts are checked on changes, when returning to the app and every minute while visible. Notifications use the active service worker where available, with a desktop fallback; failed delivery does not mark a reminder as sent. A given task generates at most one successful alert per day per account/site on a device. A notification click reopens or focuses Kairo Ride. **No server was added and notifications from a fully closed or suspended PWA are not guaranteed.** The worker delivery path follows the [browser notification API](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification).

Existing records retain their manually entered schedules when opened. **Use suggested intervals** deliberately resets that form's schedule to the selected template. New optional `templateId` and `repeatDays` fields are retained in Drive/JSON/Excel history; human-readable Excel columns also include the template, repeat days and reminder flags. Update the app on every device before editing or syncing these new records: older builds use strict validation and cannot read the new fields. The database name and history version remain unchanged; no reimport or database reset is needed.

## Install on a phone

Open the published HTTPS address once while online.

- **Android / Chrome:** use the in-app install action when offered, or open the browser menu and choose **Install app** or **Add to Home screen**.
- **iPhone / Safari:** choose **Share → Add to Home Screen**, enable **Open as Web App** if shown, and confirm.

Open Kairo Ride from the new home-screen icon. A browser and an installed PWA may use separate local storage in some environments, so complete Drive synchronization or export a backup before switching between them.

## Import and export

The data tools can export:

- A JSON backup containing the complete Kairo Ride operation history.
- An Excel workbook with `Wheels`, `Records`, `Rides`, `Trips`, `Gear`, `Maintenance`, `Attachments`, `Goals`, `Archived`, `History`, and `KairoInfo` sheets.

The importer accepts Kairo Ride JSON and Excel backups, plus the supported legacy PWA workbook format containing `Rides` and `Models` sheets. Re-importing the same backup does not duplicate existing operations.

JSON and Excel backups contain attachment metadata and Drive links, **not the original GPX, photo, or video files**. Make sure original files have finished syncing to Drive or save them separately.

## Important limitations

- Version 2.0.7 is an early product build. Automated checks cover domain logic, storage, recovery, rendered UI contracts and static PWA output. Real Google OAuth, the final GitHub Pages deployment, visual layout and physical-phone interaction must still be verified with the owner's accounts and devices.
- A single attachment is limited to 512 MB. An imported backup is limited to 25 MB. The browser may impose a lower practical storage limit.
- Large uploads are not guaranteed to continue after the PWA is closed or suspended. Keep the app open until synchronization finishes.
- Maintenance and insurance notifications are local. They are checked while the PWA is open or active; a fully closed mobile PWA cannot guarantee a scheduled alert without a push-notification server.
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
| `lib/kairo/` | Domain model, statistics, localization, operation history, IndexedDB, Drive, import, and Excel logic |
| `hooks/` | Foreground automatic-sync lifecycle and responsive helpers |
| `build/` | Versioned service-worker and PWA build integration |
| `public/` | Manifest, icons, public OAuth configuration, and privacy page |
| `tests/` | Automated domain, storage, export, Drive-protocol, UI, and static-PWA checks |
| `.github/workflows/deploy.yml` | TypeScript, automated test, and GitHub Pages deployment workflow |

## Updating an existing deployment

You do not need to delete the repository before installing a patch. Uploading a file at the same repository path updates that file in the new commit. Files that are not present in the new package are not removed automatically, so delete only items explicitly named in the release notes.

For browser-only updates, upload the package contents to the repository root and commit them to `main`. Existing hidden setup files may be left in place when the release does not change them. [GitHub's browser uploader](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository) accepts up to 100 files at a time and up to 25 MiB per file.

For repeated updates, GitHub Desktop is safer and easier to review: clone the repository once, copy the new package contents over the local clone, review modified and deleted files, commit, and choose [**Push origin**](https://docs.github.com/en/desktop/making-changes-in-a-branch/pushing-changes-to-github-from-github-desktop). Never delete the local `.git` directory.

Version 2.0.7 does not require deleting any application directory or changing OAuth configuration. This archive includes the earlier 2.0.4 and 2.0.5 fixes. Upload the whole package, including the new archive and overview-extras modules. Existing deployment settings and repository variables remain unchanged. If you configured the public client ID directly in `public/kairo-config.json` instead of a repository variable, preserve that value when replacing the file. No application files need to be removed for this patch.

Before updating, export a JSON backup and preserve any unsynced original attachments. Keep the same site URL. Wait for the successful deployment, reload the app while online to fetch the update, close **all** Kairo Ride tabs/windows on each device, and reopen. The service worker intentionally waits for old windows to close before activating its new cache. Do not clear browser data or uninstall the PWA to update: this could discard unsynced records. Confirm **2.0.7** in the footer on both phone and computer before saving unnamed rides or goals. Refresh Google access if asked. Existing records do not need reimporting; database names and history version are unchanged.

## Release checklist

Before using Kairo Ride as the primary archive:

1. Add a test vehicle, odometer record, ride, trip, linked gear items, maintenance/insurance item, and small attachment.
2. Export both JSON and Excel and inspect the records.
3. Connect Google Drive, finish synchronization, and open the original attachment in Drive.
4. Sign in from a second device using the same site URL and Google account.
5. Install the PWA and test creating an offline record, then reconnect and sync.
6. Keep the previous database and original files until all migrated data has been verified.
7. Test all six vehicle statuses, repeat Garage visits, new-record vehicle changes, archive editing and automatic maintenance attention. Check that a blocked new record does not leave an empty trip behind.
8. Change the Hero vehicle filter: its divider label and four totals should change, while the main all-time average stays the same.

## Feedback

We welcome your feedback, comments and suggestions at [kairosbytomas@gmail.com](mailto:kairosbytomas@gmail.com).

## License

Kairo Ride is released under the [MIT License](LICENSE).
