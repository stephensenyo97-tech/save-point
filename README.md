## v6.2 – New Library (overhaul part 3 of 3)
- **List or cover grid**: the button next to the search box switches between the list and a cover-first grid (3 columns, 4 on wider screens). Your choice is remembered. Each tile shows the cover, a ♥ for favorites, ★ rating, a progress ring (a green check ring for finished games), a green dot while a session is running, and a "3d" countdown chip for upcoming Want to play games. The dot by the platform shows the status colour.
- **Sticky search bar**: search and the status chips (All / Want to Play / Playing / …) stay at the top while you scroll. The Journal's search and filters stay put the same way.
- **Filters button**: platform, sort, studio and genre now live in a panel opened by the funnel button, which shows a badge with how many are in use. The Library is no longer half filters.
- Stats, Backup, Journal and sheets pick up the glass look from v6.0; their layouts are unchanged.
- This completes the three-part overhaul (v6.0 Home + glass, v6.1 game page, v6.2 Library). Not tested on a real iPhone.

## v6.1 – New game page (overhaul part 2 of 3)
- **Hero** at the top: the cover with a blurred copy of itself as the backdrop (the whole page background takes the cover's colours), plus status, platform, rating, hours played, date added and the release countdown. A **Find cover online** button appears here when the game only has a generated cover.
- **Quick buttons**: Favorite, Up next (not shown while playing/finished), Share and Edit as one row of glass buttons.
- **Where I left off**: one pinned line per game (up to 280 characters), e.g. "Chapter 4, before the tower boss". Tap it to edit or clear. It also shows on the Home "Continue playing" card. Saved in backups; older backups import fine. It isn't offered for Finished games.
- **Collapsible sections**: **Progress & hours** (rating, completion, hours, sessions, started/finished dates) is open by default for started games; **Cover & more** (use my photo, use generated cover, Delete game) is closed. Games still marked Want to play keep the "Not started yet / Start playing" block.
- **Notes** are a timeline with a line and dots; search and tag filters from v5.2 work as before.
- Not tested on a real iPhone.

## v6.0 – Liquid glass + new Home (overhaul part 1 of 3)
- **Glass look** across the whole app: frosted top bar, a floating glass tab bar, glass sheets, translucent cards with a bright top edge. The background is tinted with the colours of the game on the Home hero (generated covers use their palette; real art uses its average colour). Blur is limited to the top bar, tab bar, sheets and the hero, to keep scrolling smooth. If iOS "Reduce Transparency" is on, or blur isn't supported, panels fall back to solid colours.
- **Home** now has:
  - **Continue playing** hero: your most recently active Playing game (or your first Up next game) with ▶ Start session / ■ End session right on the card, and a row of your other playing games.
  - **This week**: hours logged per day for the last 7 days and your streak of days in a row.
  - **Releasing soon**: a row of covers with a **live countdown** (e.g. `2d 11h 59m 54s`, then `HH:MM:SS` on the last day, then "Out now") for Want to play games with an exact date within 90 days. The game page shows the same live clock. Release dates have no clock time, so the countdown ends at 00:00 your time on release day. It only ticks while the app is open (no notifications).
  - **Still on your list**: Playing/Paused games untouched for 30+ days, with Pause / Resume.
  - Up next, Recent notes (3) and "What should I play?" are still there.
- The hours field on the game page now has the same style as other inputs.
- Library, game page, Stats and Backup keep their layouts for now; parts 2 and 3 will redesign them.
- Not tested on a real iPhone, where blur and scrolling speed can differ from desktop Chromium.

## v5.3 – Studio search and filter fix
- **Why studio search failed before:** a library game only had genres/studios if its title exactly matched the built-in list. Names like "FC 26" or "Elden Ring Deluxe Edition" got nothing. Now short names ("FC 26") and edition suffixes (Deluxe, Ultimate, Complete, Definitive, GOTY…) are matched to the built-in game, so genres, studios and release dates work for them too. Games with truly custom titles still have no studio data.
- **Library → Studio dropdown** (next to Genre), listing the studios of your own games with counts.
- **Add games → studio chips** (EA, Nintendo, Sony, Xbox, Ubisoft, Capcom, Square Enix, Bandai Namco, Rockstar, FromSoftware, Konami, Sega, Activision, Bethesda, Take-Two). Tap one to list that studio's games.
- Typing a studio in the Library search box works as before (`ea`, `rockstar`, `fromsoftware`, `electronic arts`).
- Studio data was written from general knowledge, not an official database, so some entries may be wrong or missing.

## v5.2 – Note tags, better search, year in review (part 3 of 3)
- **Tags on notes**: in the note form add tags separated by commas (e.g. `boss, missable, secret`). Up to 8 per note, lowercase, 24 characters each; your existing tags appear as quick-tap suggestions. Tags show on each note; tap one to open the Journal filtered to it.
- **Journal**: a row of tag chips with counts, and a smarter search: every word must match somewhere in the note's title, text, tags or game name (`#secret statue`, `hades fast`).
- **Game page**: a notes search box appears once a game has 6 or more notes.
- **Year in review** (Stats → "Your year in review", or `#/year`): finished / started / added counts, finished per month, top-rated finishes, everything you finished, most played, platforms and genres finished, most-used tags, and a shareable 1080×1350 image card. Switch between years with the chips.
  - It is built only from dates already saved: finish date, start date, date added, note dates, and hours logged in the app since v4.7. Games finished without a finish date aren't counted; hours typed in as a single total have no date, so they aren't in "hours logged".
- Backups: tags are saved in the backup file; older backups without tags import fine.
- Not tested on a real iPhone; only desktop Chromium with mocks.

## v5.1 – Upcoming releases (part 2 of 3)
- **Countdowns**: games with an exact release date show "Out in 3 days", "Out tomorrow", "Out today" or "Out in 2 months" on library cards, the game page, Add games and the picker. Games with only a year (e.g. 2027) or TBA show no countdown.
- **Home → Releasing soon**: Want to play games (including Up next) releasing within 90 days, soonest first, kept for a week after release as "Out now". "See all" opens the Library's **📅 Upcoming** filter.
- **Add games → Only upcoming**: unreleased games sorted by date.
- Release dates were checked against two public release calendars on 19 Oct 2026 and matched; 22 more games with confirmed dates were added (they have no genre/studio info yet). Dates can move: the app can't update itself, so recheck before relying on one.
- Known limits: one date per game for all platforms (e.g. Forza Horizon 6 is dated for Xbox/PC; its PS5 version is Jan 2027). Early-access games such as Path of Exile 2 keep their early-access date.
- No push notifications: iPhone can't schedule them from a web app without a server.

## v5.0 – Backup notice on the Backup page, cleaner Want to play (part 1 of 3)
- The **backup reminder** no longer sits on Home/Stats. It shows only at the top of the **Backup** page (with a "Back up now" button), plus a small dot on the Backup tab when a backup is due. The "Remind me to back up" setting is on the same page.
- **Want to play** games no longer show rating, completion or hours (you haven't played them). The game page shows "Not started yet" with a **Start playing** button; tapping **Finished** still reveals rating and sets 100%. Library cards hide the empty progress bar for these games.
- If the app ever opens with an empty library on a phone that used to have games, Home offers "Restore from a backup file" (already present since earlier versions).
- Not yet tested on a real iPhone; only desktop Chromium with mocks.

## v4.9 – What should I play?
- Home → **🎲 What should I play?** picks a game for you. Two modes:
  - **From my list**: a random game from Want to play and Paused (paused is optional). Up next counts 4×, favorites 2.5×, paused 2× as likely as a plain Want-to-play game. It never repeats a game until every one has been shown.
  - **Something new**: a random game from the built-in list that isn't in your library yet. Released games only, unless you tick "Include upcoming games". Buttons add it as Want to play, Up next, or start it right away.
- Pick a **platform** and/or **genre** first (any of the 6 platforms and ~25 genres in Something new); it re-rolls as soon as you change a filter.
- "Pick another" cycles through everything that matches before repeating. "Something new" picks uniformly; there is no ratings data to rank by.

## v4.8.1 – Easier hours and completion
- **Hours played** is now a plain field on the game page: type the hours you've played so far, or the total it took to finish (e.g. 45.5). It saves when you tap out of the field. Start session and + Add hours are still there as optional helpers.
- **Completion** has quick buttons (0 / 25 / 50 / 75 / 100%) next to the slider.
- Setting completion above 0%, or any hours, on a game that is still "Want to play" moves it to **Playing** (you can change the status back any time).

## v4.8 – Search by genre and studio (part 1 of 2)
- New file **games-meta.js**: genres and studios (developer + publisher) for all 1,457 built-in games. It was written from general knowledge, not an official database, so some entries may be off; each line is easy to edit (see the comment at the top of the file).
- **Add games**: the search box now understands genres and studios. Examples: `rpg`, `sports`, `horror ps5`, `fromsoftware`, `rockstar`, `naughty dog`, `ea sports`, `fc 27 ea sports`. Short names work too (`ea`, `sony`, `xbox`, `ubi`). Genre chips under the search box fill it in one tap. Each row shows its genres and main studio.
- **Library**: the search box also matches genres and studios of your games from the built-in list, and there is a **Genre** filter. Games you typed in yourself have no genres.
- **Game page**: genre and studio chips; tap one to search your library for it.
- **Stats**: a "By genre" card.
- Added **EA Sports FC 27** (out 25 Sep 2026).
- Part 2 (next) refreshes the upcoming-release dates in the list and adds countdowns.

## v4.7 – Hours played (phase 3 of 3)
- Everything is shown in **hours** (e.g. "12.5 h"). Under the game's completion slider: **Start session** (timer), **End session & add hours**, **Add hours** (type 1.5 for an hour and a half), **Edit total hours**.
- Starting a session sets the game to Playing (unless finished). Only one session can run at a time. A session counts from the clock, so it keeps running if you close the app; one session is capped at 12 h when ended (use Edit total if you really played longer). Under 1 minute adds nothing.
- Stats → **Hours played**: total, last 7 days, per-week bars for the last 8 weeks, and most played. The weekly bars use the dated log of sessions/added hours; "Edit total" changes the total only. The log keeps the last 300 entries per game.
- Library shows hours on each game and has a **Most hours played** sort; Home shows total hours.
- Hours are part of backup files (same format 2; older backups import with 0 h, and an older app version importing a newer backup would drop the hours).
- Not tested on a real iPhone. The timer is clock-based, not a background process, so it can't beep or notify.

## v4.6 – Safer backups (phase 2 of 3)
- **Backup reminder**: a banner appears when you have unsaved changes and your last backup is older than the interval you pick (Backup tab → Remind me to back up: 1 week / 2 weeks / 1 month / never). No changes since the last backup = no nagging. The older "No backup yet" and "10+ changes" notices still work.
- **Last backup** now also shows "(3 days ago)".
- **Check a backup file**: pick a saved backup and see how many games, notes and photos it holds and when it was made, without importing anything. Use it after "Save to Files" to be sure the file is good.
- Limits: the app can't see where the share sheet put the file or whether you really chose "Save to Files"; it marks the backup as done when the share sheet closes without being cancelled. Reminders show only when you open the app (a web app on iPhone can't notify you in the background). Not tested on a real iPhone.

## v4.5 – Fix missing covers (phase 1 of 3)
- **Backup → Cover art → Fix missing covers (N)**: a second, wider automatic try for games that still have no real cover. It tries safe alternative spellings (without "Remastered/Complete Edition", Wikipedia-style capitals, "7" ↔ "VII", with/without "The", with/without "Marvel's"). Series pages are never accepted.
- Whatever is still missing can be reviewed one by one. This is the only place subtitle-less guesses (e.g. "Foo: Bar" → "Foo") are offered, and only for you to confirm.
- A match you confirm is now remembered for that title, so re-adding the game on another platform reuses it.
- Not tested against the live Wikipedia or a real iPhone; the hit rate on your list is unknown until you run it.

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
3. On your phone, open Save Point **while online** (GitHub Pages can take 2–5 minutes after you commit; to check, open `https://YOURNAME.github.io/save-point/sw.js` in Safari and look for the version on the `VERSION =` line) → **Backup tab → App version & updates → Check for update**. If it says it was updated, tap **Reload**.
4. The Backup tab shows the version (`v4.4`) and how many games are in the built-in list, so you can see you really got the new one. Your journal is never touched by an update.

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

**Real cover art (v4.2):** for each game your phone asks Wikipedia for the article by its *exact title* (up to six likely spellings per game, e.g. "God of War (2018 video game)", "God of War (video game)", "God of War"), about 14 games per request. It only accepts an article that Wikipedia describes as a game (so "Hades" the Greek god or the "Control" disambiguation page are rejected), downloads the cover thumbnail, shrinks it and keeps it on the phone. Covers load by themselves for your library and for the rows you scroll past in *Add games*; **Backup → Cover art → Download covers for the whole game list** fetches the entire built-in list (about 100 requests, then it is all offline). You can switch the automatic loading off there (then no game titles are ever sent anywhere). Games with no clear article remember that and are not asked again for 3 weeks; for those use the game's **Find cover online** (pick from search results) or **Use my photo**. Fetched covers are a re-downloadable cache and are not in backup files; photos you pick yourself are.

**Confirm covers yourself (v4.4):** after you add games, the app can show each game's cover candidate and ask **"Is this the cover?"**. It shows the picture, a link to the Wikipedia page it came from, and buttons: **Yes, use this cover** (only then is it downloaded and saved), **Not this one** (next candidate), **Skip**, **Search images ↗** (opens an image search so you can save a picture to Photos) and **Pick a photo from my phone**. The same screen opens from a game's **Find cover online** button and from **Backup → Cover art → Review covers for my games one by one**. You can turn the after-adding prompt off in the same place.

**Why the bulk download got so few covers (fixed):** Wikipedia hides copyrighted (non-free) cover images from its API unless the request says `pilicense=any`, which the first versions left out. Image sizes are now also the standard Wikimedia widths, and throttled downloads (HTTP 429) are retried. If the bulk download still reports failures it now shows the last error message.

**Update check (v4.3):** it now reads the version GitHub is serving, says exactly what it found, waits for a new version to install, and has a **Force refresh app files** button that clears only the app's cached files (never the journal). Tested with a simulated newer version.

**Tested with a simulated Wikipedia only** (title variants, redirects, wrong pages rejected, 1,456 games in 100 requests, offline use, remembering misses, service down, turning it off). **Not tested against the live Wikipedia or on a real iPhone.** Expect some games (very new, obscure or oddly named ones) to keep generated covers.

**Covers, honestly:** the app does not contain official box art (that is copyrighted, and my environment can't download it). Covers are generated on your phone from the title, and you can swap in your own photo or screenshot per game. Photos make backup files bigger (roughly 30–60 KB each).

**Not tested:** real iPhone Safari / Home Screen behaviour (Chromium was the only engine available), including the iOS share sheet. Please try the install, go offline (Airplane Mode), add a note, and do one export/import round-trip on your phone before trusting it with anything important.
