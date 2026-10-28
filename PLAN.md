# notes_app roadmap

## Decisions

| Question | Decision |
|---|---|
| Font | **VT323** across the whole app. **Share Tech Mono** in the spreadsheet section only. |
| Python framework | **Django**, with logins and per-user data at minimum |
| Phone | **Browser install (PWA)** to start. App stores maybe later. |
| What runs on the phone | **The Django app.** Rails stays the lead codebase: features are built in Rails first, then ported to Django. |

What these mean for the plan:

- **Rails is the prototype, Django is what you use day to day.** Every feature is built and tested in Rails, then ported. To keep porting cheap, both apps share the same URL shapes, CSS, Stimulus controllers, PWA files and template structure. Only the server side gets rewritten. See [Porting workflow](#porting-workflow).
- **Logins are built in Rails too,** before the spreadsheet. That way `SpreadSheet` belongs to a user from day one, and the Django port copies a working design instead of bolting auth on afterwards.
- **Only Django gets deployed.** The Rails app can stay local (`bin/dev`).

## Order

| # | Change | App | Depends on |
|---|--------|-----|------------|
| 1 | Style foundation (DOS + Matrix theme, fonts) | Rails | — |
| 2 | Menu | Rails | 1 |
| 3 | Logins + individual users | Rails | 2 |
| 4 | Spreadsheet section | Rails | 1–3 |
| 5 | Style polish pass | Rails | 2–4 |
| 6 | PWA files (manifest, service worker, offline outbox) | Rails | 1–5 |
| 7 | Django copy, at full parity with steps 1–6 | Django | 1–6 |
| 8 | Deploy Django and install on the phone | Django | 7 |
| ∞ | Ongoing: new features in Rails → port to Django | both | 7 |

---

## 1. Style foundation: older, but sleeker

Goal: the shared look (tokens, fonts, effects) that every later screen uses.

- [ ] **Theme tokens.** In `app/assets/tailwind/application.css`, add a Tailwind v4 `@theme` block with named colors instead of raw `green-400` / `green-800`:
  - `--color-phosphor` (bright text, e.g. `#00ff41`)
  - `--color-phosphor-dim` (secondary text)
  - `--color-phosphor-faint` (borders, ruled lines)
  - `--color-screen` (near-black background, e.g. `#020a04`)
  - `--color-alert` (errors and delete)
- [ ] **Fonts:**
  - Self-host `VT323.woff2` and `ShareTechMono.woff2` in `app/assets/fonts/` with `@font-face`. That's simpler than Google Fonts: no CSP changes, it works offline in the PWA, and it copies straight to Django.
  - `@theme { --font-mono: "VT323", ui-monospace, monospace; --font-sheet: "Share Tech Mono", ui-monospace, monospace; }`. The `font-mono` already on `<body>` then becomes VT323 everywhere automatically.
  - The spreadsheet pages put `font-sheet` on their page container (step 4).
  - VT323 runs small and narrow for its point size. Bump the base size (roughly 20px body text) and recheck the 32px ruled-line spacing in `.ruled-lines` so text sits on the lines.
- [ ] **CRT effects** (subtle, so it stays "sleek"):
  - `.crt-scanlines`: a fixed full-screen overlay with a repeating-linear-gradient at ~4% opacity and `pointer-events: none`.
  - `.crt-vignette`: a radial-gradient darkening at the edges.
  - Optional faint flicker animation, turned off under `@media (prefers-reduced-motion: reduce)`.
  - Keep `.crt-glow` on containers, per the existing convention.
- [ ] **DOS idioms as reusable classes:**
  - `.btn-dos`: bracketed label (`[ NEW ]`), inverse video on hover/focus (green background, black text).
  - `.panel-dos`: thin border with the title cut into the top edge (`┌─ NOTEPADS ─┐` look).
  - Blinking block cursor `█` in place of the `_`.
  - `::selection` in inverse video.
- [ ] **Matrix accent.** A low-opacity "digital rain" `<canvas>` behind the index page only, driven by a Stimulus `matrix_rain_controller.js`. Pause it when the tab is hidden and under reduced motion.
- [ ] **Migrate existing views** (`index`, `show`, `_note_pad`) to the new tokens and classes.
- [ ] **Styled delete confirm.** Replace the native `turbo_confirm` with a `<dialog>` styled as a DOS box (`Delete this pad? [Y]es [N]o`). Hook it up with `Turbo.config.forms.confirm = ...` in `application.js`. Y/N keys should work.

**Done when:** both existing pages use only theme tokens and VT323, and the confirm dialog matches the theme.

---

## 2. Menu

Goal: a DOS-style menu bar on every page that also works on a phone.

- [ ] **Partial** `app/views/layouts/_menu.html.erb`, rendered in the layout above `<main>`.
- [ ] **Layout:** `F1 NOTES  F2 SHEETS … [USER] LOGOUT`, with the current section in inverse video (use `controller_name`). The SHEETS item stays hidden until step 4. The user/logout items appear after step 3.
- [ ] **Keyboard shortcuts:** a Stimulus `menu_controller.js` that maps F1/F2 (and Alt+N / Alt+S, since browsers grab some F-keys) to `Turbo.visit`. Ignore keypresses while typing in an input, except for the reserved combos.
- [ ] **Mobile:** below `sm:`, collapse into a `≡ MENU` button with a dropdown, using 44px tap targets.
- [ ] **Tests:** the layout renders the menu, and the active item is marked.

**Done when:** you can move between sections by click, tap and keyboard.

---

## 3. Logins + individual users (Rails)

Goal: everyone signs in and sees only their own notes and sheets.

- [ ] **Run `bin/rails generate authentication`** (built into Rails 8). It creates `User` (email + `has_secure_password`), `Session`, `SessionsController`, password reset and an `Authentication` concern that requires login by default.
- [ ] **Sign-up:** the generator doesn't include one. Add a `RegistrationsController` (`new` / `create`) and route.
- [ ] **Ownership:**
  - Migration: add `user_id` (not null, foreign key, indexed) to `note_pads`. Existing rows need an owner first: create a user in the migration or a one-off task, assign the pads to it, then add the not-null constraint.
  - `User has_many :note_pads, dependent: :destroy`, and `NotePad belongs_to :user`.
  - Positions become per user: `set_position` uses `user.note_pads.maximum(:position)`.
  - Controllers scope every query through the current user: `Current.user.note_pads.find(params[:id])`. Someone else's ID is a 404, not their data.
- [ ] **Views:** restyle the generated login, sign-up and password-reset screens in the DOS theme (`C:\> LOGIN_` prompt style). Add the username and logout to the menu.
- [ ] **Password reset email:** this needs mail delivery later. For now, use `letter_opener` in development. The real mail provider is picked at deploy time (step 8).
- [ ] **Tests:** a `sign_in_as(user)` test helper, a `users.yml` fixture, pads fixtures with owners, and a test that user A gets a 404 on user B's pad.

**Done when:** two accounts can't see each other's notes, and all tests pass logged in.

---

## 4. Spreadsheet section

Goal: a basic grid of editable cells, following the NotePad conventions (model + RESTful controller + Turbo Streams + autosave + DOS styling + owned by a user).

- [ ] **Model** `SpreadSheet`. Migration:
  - `user_id`: not null, foreign key, indexed
  - `title`: string, not null, default "Untitled"
  - `cells`: jsonb, not null, default 3×3 of `""` (an array of rows)
  - `position`: integer, not null, default 0, indexed
  - Move the positioning into a shared `Positioned` concern used by both models.
  - Validate that `cells` is a rectangular array of strings, with a size cap (e.g. 100×26).
- [ ] **Routes:** `resources :spread_sheets, only: %i[index show create update destroy]`.
- [ ] **Controller** `SpreadSheetsController`, mirroring `NotePadsController` and scoped to `Current.user.spread_sheets`. Accept `cells` as a JSON string and parse it.
- [ ] **Views** (page container gets `font-sheet` → Share Tech Mono):
  - `index` / `_spread_sheet` row partial: same list pattern as notepads, with a `rows × cols` summary.
  - `show`: a `<table>` with column headers A, B, C… and row numbers. Each cell is an `<input>`. Use thin `--color-phosphor-faint` gridlines, and highlight the focused cell in inverse video.
  - `update` / `destroy` turbo streams like notepads.
- [ ] **Stimulus** `spread_sheet_controller.js`:
  - Move the debounce, status and keepalive logic out of `note_pad_controller.js` into a shared `autosave.js` module, used by both controllers.
  - Arrow keys / Enter / Tab move between cells.
  - `[+ ROW]` / `[+ COL]` buttons and remove buttons.
  - The grid scrolls horizontally inside its container on small screens.
- [ ] **Menu:** turn on `F2 SHEETS`.
- [ ] **Tests:** model validations, controller CRUD, autosave, and that sheets are isolated per user.
- [ ] **CLAUDE.md:** add a "SpreadSheet (built)" section.

**Done when:** you can create a sheet, edit cells, add rows and columns, reload, and see everything saved, with Share Tech Mono in the grid.

---

## 5. Style polish pass

- [ ] Check every page (notes, sheets, login, sign-up) at 375px and desktop.
- [ ] Check contrast: dim green on black must still be readable (WCAG AA on body text).
- [ ] Make focus states visible everywhere.
- [ ] Tune the scanlines, glow and rain down if they hurt readability.
- [ ] Make a phosphor-green favicon and app icons at 180, 192 and 512px, plus a maskable version.

---

## 6. PWA files (built in Rails, deployed via Django)

- [ ] **Enable the routes** in `config/routes.rb`:
  ```ruby
  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker
  ```
  Then uncomment the `<link rel="manifest">` in the layout.
- [ ] **Manifest:** real `name` / `short_name`, `theme_color` and `background_color` set to the screen black (currently `"red"`), and the step 5 icons.
- [ ] **iOS:** 180px `apple-touch-icon`, `apple-mobile-web-app-status-bar-style: black-translucent`, and `viewport-fit=cover` with `env(safe-area-inset-*)` padding.
- [ ] **Service worker:**
  - Cache the app shell (CSS, JS, both fonts, icons) on install.
  - Network-first for HTML, with a cached fallback.
  - Never cache login or session responses.
- [ ] **Offline outbox:**
  - In `autosave.js`'s `catch` block, queue failed saves in IndexedDB, and retry on `online` and on next load. The status shows "offline — queued (n)".
  - If the server answers 401 because the session expired, keep the queued edit and send the user to login. Don't drop it.
- [ ] **Test on the phone locally:** run `bin/dev` behind an HTTPS tunnel (Cloudflare Tunnel / ngrok) and install it from Safari or Chrome.

---

## 7. Django copy

Goal: the same app, the same look, the same behavior, in `../notes_app_py` (a sibling folder and its own git repo).

- [ ] **Scaffold:**
  - `django-admin startproject config .` plus apps `accounts`, `notepads` and `spreadsheets`.
  - PostgreSQL via `psycopg` and a separate `notes_app_py_development` database.
  - Use `uv` (or `pip` + `venv`) for dependencies.
- [ ] **Auth (Django has this built in):**
  - A custom `User` model from day one (`AbstractUser` with email as the login field). It's painful to change later.
  - `django.contrib.auth.views` for login, logout and password reset. A small sign-up view.
  - `LoginRequiredMiddleware` (Django 5.1+) mirrors Rails' "require login by default".
- [ ] **Models:**
  - An abstract `Positioned` base model (positions per user) and `Meta.ordering = ["position"]`.
  - `NotePad` and `SpreadSheet` with `ForeignKey(User, on_delete=CASCADE)`.
  - `cells = JSONField(default=default_grid)`, with the same validation as Rails in `clean()`.
- [ ] **URLs / views:**
  - The same paths as Rails: `/note_pads/`, `/note_pads/<id>`, `/spread_sheets/…`, `/session`, `/manifest.json`, `/service-worker.js`.
  - Every queryset goes through `request.user.note_pads`, so another user's ID is a 404.
- [ ] **Turbo, not htmx:** Turbo and Stimulus work with any backend. Load the same `turbo.min.js` / `stimulus.min.js`, and have update/delete views return `text/vnd.turbo-stream.html` templates. That keeps every Stimulus controller and turbo-stream template nearly identical, which is what makes the ongoing porting cheap. (`turbo-helper` / `django-turbo-response` exist, but a small `turbo_stream()` helper is enough.)
- [ ] **Templates:** port the ERB to Django templates with the same file names and structure (`base.html`, `_menu.html`, `note_pads/_note_pad.html`, …). The CSRF meta tag becomes `<meta name="csrf-token" content="{{ csrf_token }}">`, so the JS doesn't change.
- [ ] **Front-end assets:**
  - Copy `application.css`, the fonts, the Stimulus controllers, the PWA manifest/service worker and the icons verbatim.
  - Build the CSS with the Tailwind v4 standalone CLI, pointed at the Django templates.
  - Serve static files with WhiteNoise.
- [ ] **Tests:** port the Rails tests one for one to Django `TestCase`, including the per-user isolation tests.
- [ ] **Dev run:** a `Procfile.dev` + `honcho` for `runserver` and the Tailwind watcher, mirroring `bin/dev`.

**Done when:** both test suites pass, and the two apps look and behave the same side by side.

---

## 8. Deploy Django + install on the phone

- [ ] **Hosting** for a small Django + Postgres app with HTTPS. Pick one:
  - **Fly.io, Render or Railway:** easiest. Managed Postgres and automatic HTTPS.
  - **A VPS with Kamal:** the same tool the Rails app is set up for. Kamal deploys any Docker image, so the Django app needs a `Dockerfile` + `config/deploy.yml`. Cheapest, but you manage it more yourself.
- [ ] **Production settings:**
  - `DEBUG=False`, `SECRET_KEY` from env, `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`.
  - Secure cookies, and `SECURE_PROXY_SSL_HEADER`.
- [ ] **Email** for password reset (e.g. Postmark, Resend or SES), via `EMAIL_BACKEND` settings.
- [ ] **Install:**
  - iPhone: Safari → Share → Add to Home Screen.
  - Android: Chrome → ⋮ → Install app.
- [ ] **Backups:** turn on automated Postgres backups. This is where your real notes live now.

**Done when:** the app is on your home screen, you're logged in, and edits made offline sync when you're back online.

**Later option:** wrap the deployed site with Capacitor or Hotwire Native for App Store / Play Store listings. This needs a $99/yr Apple developer account and a $25 one-time Google fee.

---

## Porting workflow

How changes flow from Rails to Django after step 7:

1. **Build and test the feature in Rails.** Commit as usual.
2. **Shared files are copied, never rewritten.** Copy them verbatim:
   - `app/assets/tailwind/application.css`
   - `app/assets/fonts/*`
   - `app/javascript/**`
   - PWA files and icons
   - A `bin/sync-shared` script in the Rails repo can rsync these into `../notes_app_py` so step 2 is one command.
3. **Server-side code is ported by hand,** following a mapping table kept in the Django repo's README:

   | Rails | Django |
   |---|---|
   | migration | `makemigrations` from the model change |
   | model + concern | model + abstract base / mixin |
   | controller action | view function / class |
   | `.html.erb` | `.html` template, same name |
   | `.turbo_stream.erb` | `.turbo_stream.html` template, same name |
   | `Current.user` | `request.user` |
   | Minitest test | `TestCase` test, same name |

4. **Parity check:** run both test suites and click through the changed screen in both apps.
5. **Deploy Django.**

Keeping a `CHANGELOG.md` in both repos ("ported from Rails `<sha>`") makes it easy to see what hasn't been ported yet.
