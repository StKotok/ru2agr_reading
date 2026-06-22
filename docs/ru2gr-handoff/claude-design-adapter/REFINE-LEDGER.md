# REFINE-LEDGER — docs/ru2gr-handoff

Intended, value-CHANGING design edits. Each entry is a declared change; anything in the
diff that is NOT listed here is a bug.

## 2026-06-22 — Пергамент `alt` tint
- **Token:** `THEMES.Пергамент.alt` (feeds `paper2` + `sidebar`)
- **Change:** `#E3DDD0` → `#E7E1D3`
- **Reason:** adopt the Greek-screen tint as the canonical Пергамент panel/sidebar surface (user decision).
- **Where applied:** canonical `project/ru2gr-tokens.js`.
- **Runtime effect:** Пергамент `paper2`/`sidebar` render warmer/lighter on screens that
  consume `alt` directly (mainly «Греческая»). «Слова» overrides `paper2`/`sidebar` in its
  contrast pass, so it is largely unaffected.
- **Verification:** Tier-2 (rendered) NOT run — the bundle has no render path (README: don't
  render). This change is intended and not value-preserving, so Tier-1 does not apply to it.

## 2026-06-22 — «Греческая» gains contrast levels (CONTRACT-1)
- **Change:** «Греческая»'s `palette()` switched from a plain theme lookup to the shared
  contrast-aware `buildPalette()` (default level «Чёткий»; `contrast` prop now wired into its `dc-import`).
- **Runtime effect:** «Греческая» now derives `content/card/sidebar/titlebar/read/line/line2/cardLine/shadow`
  via elevate/recess (previously raw theme values). Visual change, **intended**.
- **Reason:** unify both screens on one palette contract (user decision).
- **Verification:** Tier-2 (rendered) NOT possible (no render path). Shared builder
  smoke-tested in node (loads, produces sane surfaces). Offline fallback keeps the old plain lookup.

