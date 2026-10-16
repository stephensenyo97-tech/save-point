# Save Point – your gaming journal

A private gaming journal that installs on your iPhone Home Screen. No account, no subscription, no server of yours.

Files: `index.html`, `styles.css`, `app.js`, `games-catalog.js` (built-in game list), `sw.js` (offline), `manifest.json` (installability), `icons/`.

---

## 1. Put it online once (free, ~5 minutes, GitHub Pages)

PWAs must be installed from an `https://` address. GitHub Pages gives you one for free and you never maintain it.

1. Create a free account at github.com and click **New repository**. Name it e.g. `save-point`, set it **Public** (free Pages needs public), click **Create**.
   - Public only means the *app code* is visible. Your journal is never uploaded; it stays on your phone.
2. On the new repo page click **uploading an existing file**. On a computer, drag in **everything inside the `save-point` folder** (including the `icons` folder), then **Commit changes**.
3. Go to **Settings → Pages**. Under *Build and deployment*, set Source to **Deploy from a branch**, Branch **main**, folder **/ (root)**, then **Save**.
4. Wait 1–2 minutes. The page shows your address: `https://YOURNAME.github.io/save-point/`. Open it on your phone to check it loads.

After this you can delete nothing and run nothing; the site just sits there.

## 2. Install on your iPhone

1. Open the address above in **Safari**.
2. Tap **Share** (square with arrow) → **Add to Home Screen** → **Add**.
3. **Close Safari. Open Save Point from the new Home Screen icon.** Add your games *there*.
4. Go to the **Backup** tab. You should see *Offline app files: Cached* and *Running as installed app: Yes*.

> **Important:** Safari tabs and the Home Screen app keep **separate** storage. Anything typed into a Safari tab will not appear in the Home Screen app. Only use the icon.

## 2b. Updating to a new version (what you do every time)

1. On your repo page: **Add file → Upload files**, drag in every file from this folder (including `games-catalog.js` and the `icons` folder), tick nothing else, **Commit changes**. Same names replace the old ones.
2. Wait 1–2 minutes for GitHub Pages.
3. On your phone, open Save Point **while online** → **Backup tab → App version & updates → Check for update**. If it says it was updated, tap **Reload**.
4. The Backup tab shows the version (`v4.1`) and how many games are in the built-in list, so you can see you really got the new one. Your journal is never touched by an update.

To add games to the list yourself, edit `games-catalog.js` (one game per line, instructions at the top), bump `VERSION` in `sw.js`, and upload.

## 3. How offline works

On first open (with internet) the app downloads all its own files into the phone's cache. After that, opening it needs no internet at all. The app makes no network requests for your data. Updates: if you ever change the files, bump `VERSION` in `sw.js` and re-upload; the phone picks up the new version the next time it opens the app online.

## 4. How your data is stored

Games and notes are saved on the phone in the browser's **IndexedDB** after every change, with a second copy in localStorage. Nothing is sent anywhere. Limits to know:

- Deleting the Home Screen app, clearing Safari website data, or losing/changing the phone **erases the journal**. Only a backup file survives that.
- iOS can free up website storage under extreme low-space conditions. The Backup tab shows whether the browser granted "protected" storage; treat it as not guaranteed.
- The journal and backup files are **not encrypted**. Anyone with your unlocked phone can open the app.

## 5. Backups (do this regularly)

- **Backup tab → Save backup file** opens the iPhone share sheet. Choose **Save to Files** (pick iCloud Drive so it also survives losing the phone).
- **Import backup file** restores it: *Merge* (adds to what's there) or *Replace*. Both can be undone from the same page.
- Moving phones: install the app on the new phone, then import your latest backup.
- Fallbacks: *Copy as text* / *Import pasted text* if file sharing misbehaves.
- The app reminds you if you've never backed up or have 10+ unsaved-to-backup changes.

## 6. Game list (autocomplete) and how to update it

When you add a game, type a few letters and tap a suggestion to fill in the title and platform. The list lives in `games-catalog.js`: about 700 popular PS5/PS4/PC/Xbox/Switch titles. It is a convenience list, not a complete database, and you can always type any title yourself.

To add games or fix platforms:
1. On GitHub open your repo → click `games-catalog.js` → click the **pencil icon** (Edit).
2. Add one line per game, e.g. `Some New Game | PS5 PC`. (Platforms: PS5 PS4 PC Xbox Switch Mobile.)
3. Click **Commit changes**.
4. Open `sw.js`, click the pencil, and change `const VERSION = 'v2';` to `'v3'` (then `'v4'` next time, and so on). Commit. **This step is what makes phones download the new list.**
5. On your iPhone, open Save Point while online, close it fully, and open it again. Your journal data is not touched by updates.

## 7. What was tested (and what wasn't)

Tested in headless Chromium at iPhone size, served from a sub-folder like GitHub Pages does: installing the service worker; opening the app with the server completely stopped; adding/editing/deleting games and notes while offline; data surviving reloads; export → wipe all browser data → import restores everything exactly; merge, replace, undo, erase; rejecting bad/hostile backup files; recovery from the localStorage copy if IndexedDB is lost.

**v3 Part 1 additionally tested:** adding several games in one go (search, tick, add), platform/status choice for the batch, games already in your library shown as disabled, ratings 1–10 (set, change, clear, survive reload, sorted by), old v1/v2 backups still importing, backups from a *newer* app version refused with a clear message, the update check, and the app opening with the server stopped.

**v3 Part 2 additionally tested:** favorites, Up next list (home shortcut, Start button, library filters), started/finished dates (set automatically when you change status, editable by hand, "finished in N days"), dates and flags surviving reload, and bad values in imported backups being cleaned.

**v3 Part 3 additionally tested:** the Stats tab (totals, average rating, status/platform/month bars, rating histogram, top rated, empty state) and the share card (1080×1350 PNG, long titles wrap, handed to the share sheet as a file, falls back to a download when sharing isn't available). The iPhone's real share sheet and "Save Image" step are untested.

**v4 (covers) additionally tested:** every game gets a clean generated cover (same game = same cover every time, shown in the library, the add-games list, the game page and the share card); hostile titles can't inject anything; your own photo (cropped and shrunk to a small 360×480 JPEG), kept after reload, included in backups, restored by import and by Undo, removable, and non-pictures give a friendly error; bad photo data in a backup is rejected.

**Real cover art (v4.1):** each game's page has **Find cover online**, and the Library has **Find real covers online**. Your phone searches Wikipedia, downloads the cover thumbnail and keeps a small copy, so after that it works offline. Bulk mode only saves exact title matches (e.g. it will not accept "Hades (mythology)") and skips the rest, which you can fix one by one. Tested only against a simulated Wikipedia (found/not found, wrong page, bad image source, offline, service down, stopping early). **Not tested against the live site**, so if it can't reach Wikipedia from your phone, the generated covers and "Use my photo" still work.

**Covers, honestly:** the app does not contain official box art (that is copyrighted, and my environment can't download it). Covers are generated on your phone from the title, and you can swap in your own photo or screenshot per game. Photos make backup files bigger (roughly 30–60 KB each).

**Not tested:** real iPhone Safari / Home Screen behaviour (Chromium was the only engine available), including the iOS share sheet. Please try the install, go offline (Airplane Mode), add a note, and do one export/import round-trip on your phone before trusting it with anything important.
