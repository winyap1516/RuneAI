# Repository Guidelines

## Project Structure & Module Organization
This repo couples a static Vite client with Supabase edge functions. `index.html` is the public landing/auth shell, while `dashboard.html` is the post-login surface rendered only after the guards in `js/main.js` succeed. All UI fragments in `components/` must remain HTML-only; behavior lives in `js/features/*` modules that `main.js` imports and initializes (`initAuthModals`, `initSettingsPanel`, `initDigestModal`, etc.). Shared logic stays in `js/*.js`, translations in `languages/*.json`, and design/reference docs in `logo/`, `mymd/`, and `solo/`. Backend glue resides in `supabase/functions/<name>/index.ts` with configuration tracked via `supabase/config.toml`. Keep large binaries out of Git beyond `screen.png`.

## Build, Test, and Development Commands
- `npm install` - installs Vite and Supabase tooling; rerun whenever `package-lock.json` moves.
- `npm run dev` - launches the HMR dev server (defaults to `USE_LOCAL_DB=true` for mock data).
- `npm run build` - produces optimized assets in `dist/`; required before updating `CHANGELOG.md`.
- `npm run preview` - serves the built output to mimic CDN routing and guards.

## Coding Style & Naming Conventions
Use 2-space indentation and ES modules everywhere. File names are kebab-case (`settings_panel.html`, `user_welcome_card.js`), functions/variables are `camelCase`, and exported singletons follow `initFeature` naming so `main.js` stays declarative. Do not embed `<script>` tags inside `components/`; wire interactions through feature modules and relative `./js/*` imports to avoid Vite `html-proxy` issues. Strings keys in `languages/*.json` stay camelCase and must be registered in `js/language.js`. No formatter is enforced, so match existing spacing, trailing commas, and comment banners.

## Generation Constraints（生成约束补充）
- 入口唯一：页面仅引入 `js/main.js`（`<script type="module" src="js/main.js"></script>`）。
- 目录归属：
  - UI 交互脚本 → `js/features/<feature>.js`（必须导出 `mount/unmount`）。
  - 纯逻辑/请求/会话/存储 → `js/utils/<name>.js`（UI 禁止写在 utils）。
  - 组件交互封装 → `js/components/<component>.js`（供入口初始化绑定）。
- 文案统一：`languages/*.json` + `t(key)`，禁止硬编码用户可见文本。
- 路径规范：所有 `import` 均为相对路径，禁止以 `/js/...` 开头的绝对路径。
- Mock 优先：当前阶段所有 `fetch` 经由 `js/utils/api.js` 的 `mockLogin/mockSignup/mockList` 等方法。
- 禁止 `<script>`：组件 HTML 仅含结构与 `data-*` 属性，无内联脚本；入口统一初始化。

## Testing Guidelines
Automated tests are not present yet; when adding them, place Playwright or Vitest specs under `tests/` and assert redirects (e.g., guest access to `dashboard.html` must bounce to `index.html`). For now, smoke-test every change with `npm run dev`, toggling `USE_LOCAL_DB` when you need Supabase integration, then run `npm run preview` to confirm component fetching, auth modals, settings import/export, and digest flows across languages.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat:`, `fix:`, `chore:`) to mirror the "Added/Changed/Fixed" sections in `CHANGELOG.md`. Always update the changelog and bump the version banner in `README.md` when user-facing behavior shifts. PRs should describe the scenario, link tracking issues, list manual test notes (commands + browsers), and attach screenshots of dashboard/index changes. Include Supabase migration notes if edge functions or `.env` contracts move.

## Security & Configuration Tips
Keep secrets in `.env`; only the public `SUPABASE_ANON_KEY` belongs in the repo, never the service role key. Document any new environment flags beside the constants at the top of `js/main.js` and echo them in `README.md`. When working on `supabase/functions`, use `supabase functions serve <name>` locally, sanitize logs before sharing, and ensure exported bundles do not reintroduce inline credentials.
