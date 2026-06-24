# claude-design-adapter — Roadmap (future ideas)

**v1** ships the Claude Design front-end — modes `reconcile → tidy → functionalize → refine`, on
**one-time Claude Design exports** in the two shapes Claude Design emits (a DC `.dc.html` bundle
**and** a React/Babel HTML bundle — `profile-project` detects which), edited thereafter in the
project. Everything below is deferred to v2+.

Architecture note: the agent **core is stack-agnostic** (the audit/extract/name/apply/verify
engine). v1 only *front-ends* it for Claude Design exports. The items below extend that core; they
don't replace it.

## v2 — Export / port to other stacks
- `port` mode: project the clean, in-project DC design onto a target stack (React / HTML /
  Angular / Flutter / SwiftUI) + an `IMPLEMENTATION.md` contract.
- Gate: per-element parity vs the clean DC contract; pixel-perfect, no guessing.
- Needs: a per-stack mapping layer over the stack-agnostic core; `port` to be tested by actually
  porting one screen and checking parity (a happy-path pipeline run does not exercise it).

## v2 — Non-Claude-Design inputs (true universality)
- v1 front-ends **only Claude Design exports** (the DC and React/Babel shapes), and deep-mode
  validation so far concentrates on the DC shape (N≈1 stack-family). v2 could accept other design
  tools' exports or existing codebases (CSS custom properties, Tailwind, CSS-in-JS, SwiftUI, Flutter).
- Needs: ≥1 non-Claude-Design fixture; a `profile-project` `kind` for such sources; re-validate the gates.

## Backlog / ideas
- A Storybook-style states/variants gallery as an optional part of `functionalize`.
- Persisted, replayable tweak layer — **only** if a re-export workflow ever appears. Currently
  out of scope: import is a one-time DC export and editing happens in the project.
- (append ideas as they arise)
