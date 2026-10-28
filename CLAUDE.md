# notes_app

Rails 8.1 / Ruby 3.4.2 / PostgreSQL / Tailwind v4 / Hotwire (Turbo + Stimulus via importmap).
Run with `bin/dev` (Rails server + Tailwind watcher), tests with `bin/rails test`.

## Users + logins (built)
- Rails 8 authentication generator: `User` (email + `has_secure_password`, 8+ char passwords), `Session`, `Current`, `Authentication` concern
  (login required by default; opt out with `allow_unauthenticated_access`). Sign-up is `RegistrationsController` (`resource :registration`).
- Everything belongs to a user. Controllers always query through `Current.user.<things>`, so another user's record is a 404.
- `request_authentication` redirects page loads to the login page, but answers background requests that don't accept HTML
  (autosave fetches) with **401**, so the JS can react instead of silently "saving" to a login page.
- Dev mail (password resets) opens in the browser via `letter_opener`.
- Tests: `sign_in_as(users(:one))` / `sign_out` (test/test_helpers/session_test_helper.rb). Fixture password is "password".

## NotePad (built)
- `note_pads`: `user_id` (not null, FK); `title` string, not null, default "Untitled"; `body` text; `position` integer, not null, default 0.
  `before_create` puts new pads at the end of the owner's list (`max(position) + 1`). List order is `NotePad.ordered`.
- Routes: `resources :note_pads, only: index/show/create/update/destroy`, root is the index.
  There is no new/edit page: "+ NEW" POSTs create, which redirects straight into the pad. Show is also the editor.
- `update` and `destroy` answer with Turbo Streams (`update.turbo_stream.erb` replaces the row, `destroy` removes it).
- Autosave: `app/javascript/controllers/note_pad_controller.js`. Waits 600ms after typing stops, then PATCHes title and body with fetch (no form submit).
  Status shows editing/saving/saved/error/offline. `disconnect()` saves any pending edit with `keepalive` so the last keystrokes survive navigation.
  The debounce/PATCH/status/keepalive logic lives in `app/javascript/lib/autosave.js` (`Autosave` class), shared with the spreadsheet.

## SpreadSheet (built)
- `spread_sheets`: `user_id` (not null, FK); `title` string, not null, default "Untitled"; `cells` jsonb, not null, default 3x3 of `""`
  (an array of rows of strings); `position` integer. Validated as a rectangular grid, max 100 rows × 26 cols (A–Z), 1000 chars per cell.
- `Positioned` concern (shared with NotePad): `before_create` end-of-list position per user + `ordered` scope.
- Same RESTful shape as NotePad: `resources :spread_sheets, only: index/show/create/update/destroy`, Turbo Stream update/destroy.
  Autosave sends `spread_sheet[cells]` as one JSON string; the controller parses it (bad JSON or bad grid → 422).
- `spread_sheet_controller.js` draws the grid from the `cells` value, keeps edits in `this.cells`, and autosaves through `Autosave`.
  Arrows/Enter move between cells. + ROW / + COL append; − ROW / − COL remove the selected row/column.
- Spreadsheet pages put `font-sheet` (Share Tech Mono) on their page container. Grid styles are `.sheet-grid` in application.css.

## Menu
- `layouts/_menu.html.erb`, rendered on every page above `<main>`: a sticky DOS menu bar. The active section is in inverse video (`aria-current="page"`).
- Each item declares its shortcut with `data-menu-key` (F-key) and `data-menu-alt` (Alt+letter). `menu_controller.js` handles them,
  even while typing, and collapses the menu into `≡ MENU` below `sm:`. Add new sections to the `items` list at the top of the partial.

## PWA + offline (built)
- Installable: `/manifest.json` and `/service-worker.js` (Rails `rails/pwa` routes, views in `app/views/pwa/`), icons in `public/`,
  iOS meta tags + `viewport-fit=cover` with `env(safe-area-inset-*)` padding on `<body>` and the menu.
- Service worker (`service-worker.js.erb`): cache-first for `/assets/*` + icons (shell precached, versioned by asset digests);
  network-first for pages (full loads and Turbo visits) with a cached fallback; never caches `/session`, `/passwords`, `/registration`
  or redirected responses.
- Offline outbox (`lib/outbox.js` IndexedDB + `lib/autosave.js`): a failed save is queued (one entry per URL, latest wins) and
  replayed on `online` and every `turbo:load`. A 401 queues the edit and sends the user to log in; it syncs after. An editor
  that opens with a queued edit for its URL restores it via `restore(fields)`, so a stale cached page can't overwrite offline typing.
- `offline_cache_controller.js` deletes cached pages on logout and on the login page (queued edits are kept).

## Styling: DOS / CRT / matrix
- All custom CSS lives in `app/assets/tailwind/application.css`. Use the `@theme` tokens, not raw Tailwind greens:
  `phosphor-bright` / `phosphor` / `phosphor-dim` / `phosphor-faint`, `screen` (background), `panel`, `alert` / `alert-faint`.
- Fonts are self-hosted in `app/assets/fonts`. `font-mono` is VT323 (the whole app, set on `<body>`; `size-adjust` scales it up).
  `font-sheet` is Share Tech Mono (spreadsheet pages only).
- `<body class="crt-screen">` adds the scanline and vignette overlays. `.crt-glow` (phosphor text-shadow) goes on page containers, not on each element.
- Components: `.btn-dos` (`[ LABEL ]`, inverse video on hover; `.btn-dos-alert` for destructive), `.panel-dos` + `.panel-dos-title`
  (title cut into the top border), `.input-dos`, `.cursor-block` (blinking █), `.dialog-dos`.
- `.ruled-lines` makes the legal-pad textarea (32px line-height + gradient, `background-attachment: local`).
  The title is a big header with a solid 2px bottom border, and no ruled lines.
- `data-turbo-confirm` opens the DOS `<dialog>` (`layouts/_confirm_dialog`, `lib/confirm.js`, Y/N keys) instead of the browser's confirm.
- `matrix_rain_controller.js`: faint digital rain on a background canvas (index pages only; off under reduced motion, paused when hidden).
- Animations respect `prefers-reduced-motion`.
- Contrast: every text color is WCAG AA on `screen` (dim is 7:1, muted 4.8:1). `phosphor-faint` (2.2:1) is for borders only, never text;
  use `phosphor-muted` for placeholders.
- Icons: `public/icon.svg` (favicon), `icon-192/512.png` + `icon-maskable-512.png` (PWA), `apple-touch-icon.png` (180px, iOS).

## Planned
- See PLAN.md: Django port (step 7), deploy + install on the phone (step 8), then the Rails → Django porting workflow.
