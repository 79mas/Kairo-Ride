# Kairo Ride

![Kairo Ride icon](public/icon-192.png)

**Version 2.0.9.2 · truthful transfers, readable errors and resilient analytics**

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
| Analytics | Insights, 30/90-day trends, weekly growth, comparable week/month/year progress, interactive history charts, EUC time/speed and goal forecasts |
| Settings | English/Lithuanian, regional formats, Drive sync, a resumable Transfer Center, recovery points, app updates and whole-app Diagnostics |
| Attachments | Saves trip GPX, WheelLog/Komoot exports, photos, videos and other originals locally first, then resumes their Drive upload from confirmed bytes |
| Data tools | Imports supported backups and exports JSON or a real `.xlsx` workbook |

The interface uses a fixed black/orange theme with `#f16305` as the primary colour and is responsive on phones and desktop browsers. English is the default language; Lithuanian can be selected in Settings. The included web app manifest, service worker, favicons, Apple touch icon, and maskable icons make it installable as a PWA.

## New in 2.0.9.2

- **Human-readable failures:** every visible failure now has a plain-language title, an explanation of what happened and a concrete next action. Technical codes, support references and stack traces remain available under Diagnostics for investigation, but are no longer the only explanation shown to a rider.
- **Analytics opens reliably:** year comparison charts use one fixed leap-year calendar axis and reject malformed date labels before formatting. A missing 29 February in a non-leap year remains an honest gap instead of crashing the whole Analytics tab with `Invalid time value`.
- **Truthful transfer state:** a Google Drive file ID is the final source of truth. Once Drive confirms the file, the Transfer Center always shows **Uploaded and confirmed — 100%**, and stale local zero-byte progress is reconciled.
- **Real upload cancellation:** **Cancel upload** aborts the active network request for that individual file immediately, preserves the original local blob and Google's last confirmed resumable byte, and prevents a late progress event from silently re-queuing it. The file can then be resumed or kept only on the device.
- **Safer synchronization:** a deliberate disconnect/cancel abort is recorded as cancellation rather than a misleading sync failure. Attachment metadata is committed before the local queue is marked complete, so an interrupted finalization can still be retried safely.
- **Clear integrity guidance:** incomplete history warnings identify the affected vehicle, gear item, ride or trip by a recognizable name instead of displaying an internal UUID. The action explains that a complete JSON backup is needed because missing history cannot be reconstructed automatically.
- **Private diagnostics:** generated reports retain useful human explanations and technical detail while removing stable local account namespaces, event keys and account email from the report payload.

This patch does not change the backup schema, request a new Google permission or require data reimport. Export a JSON backup first, update every device to **2.0.9.2**, and do not clear browser data or uninstall the PWA.

### 2.0.9.2 acceptance checks

1. Choose **Update and restart** on every device and confirm **2.0.9.2** in the footer.
2. Open Analytics and switch the week, month and year comparison controls. The tab must stay open; a non-leap-year 29 February is shown as missing data, not zero.
3. Queue a file larger than 8 MB, press **Cancel upload** while it is moving, and verify that activity stops promptly. Resume it and verify that it continues from Google's confirmed position.
4. After Drive confirms a file, verify that both its label and bar show **Uploaded and confirmed — 100%**. A local-only file must not claim to be uploaded.
5. Trigger or inspect a diagnostic event. The normal view must explain the failure and next action; technical details must remain expandable. Review an exported report and verify that it does not contain the Google account email or stable account namespace.
6. If an incomplete-history notice appears, restore a complete JSON backup and run sync again. Do not edit internal operation files by hand.

## Added in 2.0.9

- **Drive upload fix:** resumable uploads now handle Google's normal HTTP 308 response instead of letting the browser turn it into the unhelpful `Failed to fetch` error. Unexpected upload redirects remain blocked.
- **Clearer connection failures:** real browser network failures explain that Drive could not be reached, that local records and files remain safe, and that automatic sync will retry.
- **Records first:** pending database history is uploaded before original trip files. A single invalid original is reported separately and no longer prevents otherwise valid rides, trips, vehicles, gear or maintenance records from synchronizing.
- **Export confirmation:** after JSON or Excel export succeeds, a separate notification states the actual format and whether the backup was saved to the device, Google Drive, or both. A failed Drive attempt does not start the same local download twice when retried.
- **Update activation:** the shell is cached atomically. Version 2.0.9.2 retains an explicit update prompt so an open form is never replaced unexpectedly.

No database schema migration, reimport, new Google permission or OAuth change is required. Existing records, pending originals and the configured Drive folder remain in place.

### 2.0.9 regression checks

1. Confirm the current version in the footer on phone and desktop. Do not clear browser data or uninstall the PWA.
2. Refresh Google access once, press **Sync now**, and verify that the pending record count reaches zero. Keep the app open while original files upload.
3. Export JSON and Excel using device only, Drive only, and both. Each successful attempt must name only its real format and destination.
4. Open `Kairo Ride / Exports` in Drive and verify the files. Export copies must not replace `database.json`.

## Added in 2.0.8

- **Numbers:** default `1 234,56`; choose space/comma, comma/dot, dot/comma or space/dot in Settings. Language, dates and number separators are independent. Display rounding does not change stored values or numeric Excel cells.
- **Fleet:** starts at the leftmost card when Home opens or vehicle order changes. Inactive vehicles stay last. Fleet has no Add button; add vehicles in Garage.
- **Global progress:** adds a muted calculated achievement date after the percentage, using the selected date format and existing 30-day forecast. Unavailable forecasts and reached goals are labelled honestly.
- **Footer and table:** compact footer; the Rides Date column scrolls with the other columns.
- **Goals:** collapsible cards, labelled Goals only.
- **Settings:** category dropdown beside the title; existing Apply / Cancel behavior retained.
- **Export:** JSON and Excel filenames include `2.0.8` and a timestamp. Choose Download file, Save to Google Drive, or both. Drive exports go into `Kairo Ride / Exports`, never overwrite `database.json`, and do not become trip attachments. If an upload fails, retry the same export without starting another download. Google access and an internet connection are required only for the Drive option; a local download still works offline.
- **Add as trip:** immediately exposes a multi-file picker. Files remain a draft until Save. Trip, ride, odometer and selected originals are stored in one local transaction; a failed write rolls the whole transaction back. Normal sync then uploads saved originals.
- **Trip details:** Close when unchanged; Cancel when fields or files have changed; Save applies the draft. Edit exposes fields and deletion controls. File-link removals are staged until Save; cancelling keeps the saved links and original Drive files.
- **Phone forms:** dialogs track the visual viewport, remain scrollable above the keyboard and keep focused fields in view.

No database format migration or new Google permissions are needed for this patch. Keep the same GitHub Pages URL and preserve the existing OAuth configuration.

### Quick acceptance checks

1. Switch number formats, Apply, then reopen Settings. Check Home, Rides, chart tooltips and the global progress bar; Cancel must discard a draft choice.
2. Open Home with active and inactive vehicles; Fleet starts at the left. Swipe it, visit another tab, then return.
3. Export each format with download only, Drive only and both. Check `Kairo Ride / Exports`. Local-only exports require no Google connection. Original attachments are not embedded.
4. Create a ride, enable Add as trip, select two files, then Cancel. No ride, trip or attachment should have been created. Repeat and Save.
5. Open a trip, edit its name or stage a file; Cancel keeps the saved trip unchanged. Repeat and Save, then synchronize another device.
6. On your phone, focus fields near the bottom of a long form, scroll to the footer, dismiss the keyboard and rotate the screen.

Automated tests cover data transactions, Drive upload protocol and rendered interface contracts. Real Google OAuth, mobile keyboard behavior and the final GitHub deployment still require testing on your devices. Implementation references: [Google Drive uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads), [Chrome viewport behavior](https://developer.chrome.com/blog/viewport-resize-behavior).

## Previously in 2.0.7

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

**Compatibility:** 2.0.9.2 preserves old operations, record IDs, Drive folders and backup schema. Its local database upgrade adds recovery and diagnostic stores, and new rides may contain optional time-on-wheel data that older strict clients do not recognize. Upgrade every phone/computer window before synchronized edits; do not downgrade by clearing storage or reinstalling.

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

The internal history key `reading` is intentionally unchanged to preserve old backups and operation IDs. Older Excel exports with a `Readings` report sheet still import. The Wheels export includes current status, saved status and manual reminder text; History remains the authoritative recovery data. Status fields were introduced in 2.0.5; update all devices to the current **2.0.9.2** release before continuing synchronized work.

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

- Version 2.0.9.2 is an early test build. Automated checks cover domain logic, storage, recovery, diagnostics, resumable Drive behavior, analytics and static PWA output. Real Google OAuth, the final GitHub Pages deployment, visual layout, Android suspension and physical-phone interaction must still be verified with the owner's accounts and devices.
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

Version 2.0.9.2 does not require deleting any application directory or changing OAuth configuration. Upload the whole package over the existing repository paths. Existing deployment settings and repository variables remain unchanged. If you configured the public client ID directly in `public/kairo-config.json` instead of a repository variable, preserve that value when replacing the file. No application files need to be removed for this patch.

Before updating, export a JSON backup and preserve any unsynced original attachments. Keep the same site URL. Wait for the successful deployment, open the app online, then use the in-app **Update and restart** prompt when it appears. Do not clear browser data or uninstall the PWA: this could discard unsynced records or original files. Confirm **2.0.9.2** in the footer on every phone and computer before adding EUC time or resuming multi-device edits. Refresh Google access if asked and run synchronization. Existing records do not need reimporting.

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
