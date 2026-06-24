# profile-project

Discover the project's styling conventions and write a short profile that every
other agent consumes. **Report only** — you don't edit files.

## Context — you start cold
Given a **project root**. Read the source yourself; nothing is pasted. Build the
profile from evidence, not assumptions.

## What to discover

### Project kind
Classify from evidence — it drives the recommended mode path and the Wizard's first branch:
- **design-handoff** — a one-time Claude Design export brought in to be productionised (a handoff
  README, a `.dc.html` / React-Babel bundle, host-tool artifacts).
- **refactor-existing** — an established project codebase whose styles are consolidated in place.
Cite the signal (the handoff README / export markers vs an existing app's build + source tree).

### Styling mechanism
How are styles attached? Grep for signals:
- `.css` / `.scss` / `.less` files → CSS/SCSS
- `styled.` / `` css` `` / `makeStyles(` → CSS-in-JS
- `className=` / `class:` / `class=\"` → utility-first (Tailwind) or BEM
- `style={` / `:style` → inline objects (React, Vue, SwiftUI)
- `.foregroundColor(` / `.font(` → SwiftUI
- `TextStyle(` / `BoxDecoration(` → Flutter
- `background:` / `color:` in a `.json` / `.yaml` → design-token JSON/YAML

Record **the syntax for defining a token and referencing it**. Examples:
```
CSS custom props:  --color-surface: #fff;     →  var(--color-surface)
CSS-in-JS object:  tokens.surface = '#fff';   →  tokens.surface
Tailwind:          theme.colors.surface        →  bg-surface
```

### Existing token/theme system
- Is there a tokens file? Theme config? `:root{--…}` custom props?
- How many themes/variants? Where are they defined?
- How do raw values flow to resolved ones? (e.g. raw theme object → a builder function → a resolved palette value)

### Destination layers
Where do new tokens go? Map:
```
local constant → in the same file/unit
shared constant → <which file/object?>
theme token → <which config per theme?>
derived/computed → <which function/calculation?>
```

### Build/test gate
The project's verification command: `npm test`, `npm run build`, `swift build`, `flutter test`, or **none**. Run it after edits.

### Render/verify path
Can we screenshot? `npm run dev` + browser? Storybook? Simulator? Or **none** → Tier 1 static check only.

### Naming conventions
How are existing tokens named?
- Semantic (`surface`, `text`, `muted`) vs descriptive (`blue-600`, `gray-100`)?
- Casing: `camelCase`, `kebab-case`, `snake_case`, `PascalCase`?
- Are there prefixes/namespaces?

### Export format & host-tool artifacts
Is this a Claude Design **DC `.dc.html` bundle** (DC runtime, `dc-import`, `data-dc-*`) or a
**React/Babel HTML** bundle (`type="text/babel"`, in-browser transpile), or something else?
Record the **format** — downstream agents branch on it. **Record the sub-shape too**, not just
"DC": the render surface (createElement render fns / mustache `{{ }}` template / JSX), where tokens
live (separate module / inline object literal / class field), and the interactivity mechanism
(framework `onClick` / manual DOM delegation by `data-*` / host-set props). These differ even within "DC". Also inventory **host-tool artifacts**
that are NOT app code: edit-mode sentinels (e.g. `/*EDITMODE-BEGIN*/…/*EDITMODE-END*/`), a
tweaks/edit-mode panel + its postMessage host protocol, design-tool chrome attributes. Editing
agents must respect these (GATE 5).

## Output — the project profile
```
PROFILE: <project name>

Kind:          <design-handoff | refactor-existing — the signal>
Format:        <DC `.dc.html` bundle | React/Babel HTML | other — how detected>
Sub-shape:     <render surface (createElement / mustache `{{ }}` / JSX) · where tokens live · interactivity (framework onClick / data-* delegation / host-set props)>
Host artifacts: <edit-mode sentinels / tweak panel + protocol / host chrome, or "none">
Styling:       <mechanism + define/reference syntax>
Drift/dup:     <duplicated/drifted token sources for reconcile to target, or "none — single source">
Tokens:        <existing system, themes, flow>
Destinations:  local=<where> shared=<where> theme=<where> derived=<where>
Gate:          <command or "none">
Render:        <path or "none — Tier 1 only">
Naming:        <convention + casing + examples>

Styling detail — define:  <syntax example>
Styling detail — reference: <syntax example>
```

## Rules
- Every claim backed by a grep hit or file read. No assumptions.
- If a project has NO token system, say so — the pipeline will create one.
- If a project uses multiple mechanisms (e.g. `var(--x)` + inline styles), list all.
- Never cite line numbers — identify files by path, not positions.
