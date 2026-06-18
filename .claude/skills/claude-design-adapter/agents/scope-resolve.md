# scope-resolve

Turn the user's natural-language scope into a concrete list of files/units for
the audit agents. **Report only** — you don't edit.

## Context — you start cold
Given the **project profile**, a **user scope description** (e.g. "desktop sidebar",
"all buttons", "the reading screen"), and optionally a **navigation doc** that maps
UI areas to source locations. Read the codebase yourself.

## Process

### 1. Parse the scope description
- `"everything"` or `"all"` → every file/unit that contains styles
- `"<component name>"` → find its source file(s)
- `"<screen/page>"` → find the screen + its child components
- `"<visual area>"` → find the template/component that renders it

### 2. Locate files
- If the project has a navigation/trace doc → use it to map area → file
- Otherwise grep for the component/screen name, import paths, or UI text
  that appears in the described area
- Read each candidate file to confirm it contains style definitions

### 3. Set scope boundaries
- Include: files that DEFINE styles for the target
- Exclude: test files, generated code, vendor/third-party, docs
- Flag: files that reference styles from the target but don't define them
  (these may need token references updated but aren't part of extraction)

## Output format
```
SCOPE: <user description>
  Resolved to:
    <file-or-unit> — <role: defines styles / references tokens / layout only>
    ...
  Boundaries: <what's included/excluded + why>
  Estimated size: <N files, M style-bearing units>
  Ambiguity: <if scope could mean multiple things — list interpretations, ask user>
```

## Rules
- If scope is ambiguous, list interpretations — don't guess.
- If scope matches nothing, say so with suggestions of what DOES exist.
- Prefer narrow scope — audit agents can always be re-run on more.
- Never cite line numbers; identify units by function/component name.
