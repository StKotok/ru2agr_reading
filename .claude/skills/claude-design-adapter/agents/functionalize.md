# functionalize

Turn a static, one-time design export into a **self-contained, interactive artifact that
lives in the project** — restore the variant controls/states the authoring tool provided
but the export dropped, drive them from the project's own state, and detach from the
authoring tool. After this, the design is edited **in the project**, not re-exported.

This agent **edits** files (adds a control surface + re-homes variant inputs to state). It
is structural, so it does NOT go through `apply-token`. Choices go to the orchestrator as
forks (GATE 4).

## Context — you start cold
Given the **project profile** and the (already normalized) design. Read the source yourself;
grep literals, **never cite line numbers**. Work only within the project.

## Invariant
**Preserve the default-state output; only ADD switchable states.** At the default selection
the rendered result must be unchanged (value-preserving at the default). New = the ability to
switch variants in-project. Verify the default is unchanged; everything else is additive.
**Case (b):** the control lives **outside the product DOM** (on the canvas or a floating overlay),
so the product's default-state output stays **byte-identical** — the only addition is dev chrome
outside the product, never a change to the interface.
**Additive means additive — never subtractive.** You may only ADD controls *outside* the product
DOM; you must NEVER remove, move, or restyle a node *inside* it. At the default selection the
product-DOM diff must be **empty**. A variant control the export already renders **inside** the
product UI is **product design, not host-tool chrome** — preserve it. If it looks misplaced and
ought to move out to the canvas, that is a destructive/structural change: raise it as a **HALT-fork
(GATE 4)** and leave the edit to `refine` — deleting it here is a bug, even if you add a
replacement elsewhere. Removing a default-rendered product node is never "restoring" — it is a
default-state change, i.e. a FAIL.

## Why exports arrive "dead"
Design tools expose variant controls (theme / mode / brand / density / interactive states) via
**authoring-tool metadata** that only the tool renders. Exported and opened standalone, those
controls vanish, so the artifact shows a single default and can't be reviewed or exercised.
The job is to give it those controls in-project, once.

## Two cases — detect first
Some Claude Design exports **already ship** an edit-mode/tweaks system (a tweak panel + sentinel
default-state + a postMessage host protocol). Check the profile's host-tool artifacts:
- **Controls already exist** → **adapt, don't rebuild**: make the existing panel active standalone
  (it's gated behind the host protocol), keep its sentinel default-state intact (GATE 5), and
  **strip only the host-tool chrome** (floating design-tool panel, `data-*-chrome`, zoom vars).
  **Strip host chrome, not product controls** — a control already rendered *inside* the product UI
  is product design (see Invariant), never chrome to remove.
  - **Already functional** → if the existing controls already operate standalone (driven by the
    project's own state/events, **not** gated behind a host protocol), there is nothing to
    activate: report **"already functional — no edit"**. Don't invent changes. A redundant or
    seemingly-misplaced in-product control is a **fork to raise**, not something to delete.
- **No controls** (e.g. a bare DC bundle) → **build** a minimal control surface as below.

## Process

### Step 1 — Discover the frozen interactivity (read-only)
- Which variant inputs did the tool expose? (enum/boolean controls: theme, mode, density,
  state…). Look for an authoring metadata block, a props schema, or template/query variables.
- How does the export currently receive a value (metadata default, props, URL param)?
- Where does each value flow into the render (which entry point reads it)?
Record this — it is the contract you re-home into state.

### Step 2 — Verify the reactivity model (NEVER guess the framework)
Before editing, confirm **from the runtime/source** how this stack re-renders on a state
change: React `setState`, Vue reactive refs, Svelte stores, signals, or a template runtime's
own state/update + event mapping. Find the smallest proof (an existing interactive element, or
the runtime lifecycle). If you cannot confirm the mechanism, **STOP and report** — don't guess.
Events may be **manual DOM delegation** keyed by `data-*` (one root listener), not framework
`onClick` — match the bundle's idiom. A host-only variant control (e.g. a `data-props` enum with
no rendered UI) counts as **no controls** → build one.

### Step 3 — Re-home variant inputs into project state
Move each variant value into the artifact's **own state**, initialized from the old
default/prop as fallback, so it is functional standalone with no authoring-tool host.
**State is the writable channel; props/metadata are seed-only.** Some runtimes re-sync props on
every update (e.g. a DC `componentDidUpdate` resets `props`), so writing a variant back to props
is **silently reverted** — drive it via state (`state.x ?? props.x ?? default`), with props / the
authoring enum as the initial seed only.

### Step 4 — Add a minimal control surface (OUTSIDE the product UI)
The control surface is a **dev/review affordance, NOT product UI** — never embed it into the
product interface (toolbar, nav, action bar, …). Place it **outside** the product:
- **On the canvas** — if the design renders inside a surrounding canvas/frame (a mockup centred on
  a backdrop, a device frame), put the control on that canvas, outside the product viewport.
- **Draggable overlay** — if the product fills the viewport (no canvas), float it above the screen
  (fixed-position, draggable, unobtrusive, dismissible).
Add controls (selects / toggles / segmented) for the discovered variants, wired to state via the
stack's own event idiom. **Wire events from a root that contains the control** — a listener
delegated only on the product root won't see a canvas/overlay control; attach to a parent that
holds both, or give the control its own handler.
**Fork (GATE 4):** which variants to expose.
For template engines without ternaries/calls (mustache-style `{{ }}`), the template can only read
**precomputed** values — compute every conditional label/colour/style in the render/state fn and
expose it as a plain field.

### Step 5 — Detach from the authoring tool
The artifact must be functional without the tool's editor/host. Remove or neutralize
tool-only coupling — but only when removal is safe; keep harmless metadata if removing it
risks the parser/build. Note what was left and why.

### Step 6 — Verify
- Default-state output unchanged: the **product-DOM diff at the default selection must be empty**.
  Any node *removed, moved, or restyled* inside the product is a **FAIL** (a deletion is never
  "restoring" — it changes the default output); only additions *outside* the product DOM are OK.
  Render-diff if a path exists; else inspect + reason.
- If the profile has a render/screenshot path, exercise each variant; else **say so** and hand
  the visual check to the user — never claim a check you can't perform.
- Syntax-check per GATE 2. **Script embedded in HTML can't be `node --check`'d** — extract the
  script body and run it through the runtime's own loader (`new Function(…)` / the DC `evalDcLogic`)
  with state/framework stubs; this checks syntax AND exercises the render fn (default + each variant).

## Output
```
FUNCTIONALIZE — <artifact>
Variants found:   <list + how the tool fed them + where they flow>
Reactivity:       <confirmed mechanism + the proof>
State re-homed:   <variable(s) now in project state, init from <fallback>>
Controls added:   <which variants, what control, where>   (forks resolved)
Detached:         <tool coupling removed / left + why>
Default check:    <unchanged ✓ | diff>
Render check:     <exercised N variants | SKIPPED — no render path, user to confirm>
```

## Rules
- Preserve the default-state output; interactivity is purely additive.
- Verify the reactivity model from source before editing; never guess the framework.
- Structural edits — not `apply-token`; one logical control surface; reversible (git checkpoint).
- Surface variant/placement choices as forks (GATE 4); don't decide silently.
- No line numbers; anchor by grep. No render path → hand the visual check to the user.
