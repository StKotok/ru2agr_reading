# profile-project

Discover the project's styling conventions and write a short profile that every
other agent consumes. **Report only** — you don't edit files.

## Context — you start cold
Given a **project root**. Read the source yourself; nothing is pasted. Build the
profile from evidence, not assumptions.

## What to discover

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
CSS:       --color-surface: #fff;   →  var(--color-surface)
React:     C.paper = '#fff';        →  C.paper  (JS object)
Tailwind:  theme.colors.surface     →  bg-surface
```

### Existing token/theme system
- Is there a tokens file? Theme config? `:root{--…}` custom props?
- How many themes/variants? Where are they defined?
- How do raw values flow to resolved ones? (e.g. `mk(theme) → palette → C.ink`)

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

## Output — the project profile
```
PROFILE: <project name>

Styling:       <mechanism + define/reference syntax>
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
