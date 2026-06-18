# find-components

Identify repeating visual patterns across your scope — components and their states.
Group by structure, not by location. **Report only.**

## Context — you start cold
Given a **project profile** + a **scope**. **Read the source yourself** — don't expect
files pasted. Grep for the recurring style clusters; **never cite line numbers**.

## What to find
1. **Visual duplicates** — same radius + shadow + background + animation across units = one component.
2. **State patterns** — active/inactive, open/closed, hidden/visible, hover/focus/disabled.
3. **Variant clusters** — same component, different sizes/emphasis.
4. **Repeated style objects** — identical style blocks copy-pasted.

## Output format (illustrative — find real patterns yourself)
```
COMPONENT: <VisualRole>
  States:   <list ALL, including the not-rendered / hidden one>
  Variants: <name — distinguishing props>
  NOT:      <lookalikes that are actually different — and why>
  Proposal: <shared component/style/helper, or "single-use, skip">
```

## Rules
- Name by visual role, not by where it appears.
- List ALL states, including the not-rendered one.
- Flag near-identical variants — the user decides merge vs keep.
- Don't propose a component for a single-use pattern.
