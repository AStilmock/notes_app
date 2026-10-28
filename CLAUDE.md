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
  The `catch` block (offline) is where the planned offline outbox/retry queue plugs in.

## Menu
- `layouts/_menu.html.erb`, rendered on every page above `<main>`: a sticky DOS menu bar. The active section is in inverse video (`aria-current="page"`).
- Each item declares its shortcut with `data-menu-key` (F-key) and `data-menu-alt` (Alt+letter). `menu_controller.js` handles them,
  even while typing, and collapses the menu into `≡ MENU` below `sm:`. Add new sections to the `items` list at the top of the partial.

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

## Planned
- Offline outbox + retry for autosave.
- SpreadSheet feature: follow the same conventions (model + RESTful controller + Turbo Streams + DOS styling).
