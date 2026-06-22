# claude-design-adapter — Roadmap (future ideas)

**v1** ships the Claude Design DC front-end — modes `reconcile → tidy → functionalize → refine`,
on **one-time Claude Design DC exports**, edited thereafter in the project. Everything below is
deferred to v2+.

Architecture note: the agent **core is stack-agnostic** (the audit/extract/name/apply/verify
engine). v1 only *front-ends* it for Claude Design DC. The items below extend that core; they
don't replace it.

## v2 — Export / port to other stacks
- `port` mode: project the clean, in-project DC design onto a target stack (React / HTML /
  Angular / Flutter / SwiftUI) + an `IMPLEMENTATION.md` contract.
- Gate: per-element parity vs the clean DC contract; pixel-perfect, no guessing.
- Needs: a per-stack mapping layer over the stack-agnostic core; `port` to be tested by actually
  porting one screen and checking parity (a happy-path pipeline run does not exercise it).

## v2 — Non-DC inputs (true universality)
- The core is already stack-agnostic, but v1 tests **only DC input** (N=1 stack). v2 could accept
  other design exports or existing codebases (CSS custom properties, Tailwind, CSS-in-JS,
  SwiftUI, Flutter).
- Needs: ≥1 non-DC fixture; `profile-project` `kind` for non-DC sources; re-validate the gates.

## Backlog / ideas
- A Storybook-style states/variants gallery as an optional part of `functionalize`.
- Persisted, replayable tweak layer — **only** if a re-export workflow ever appears. Currently
  out of scope: import is a one-time DC export and editing happens in the project.
- (append ideas as they arise)
