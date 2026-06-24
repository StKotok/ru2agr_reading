PROFILE: ru2gr-handoff

Format:        DC `.dc.html` bundle — detected by `<x-dc>`, `<dc-import>`, `data-dc-script`, `class Component extends DCLogic`
Sub-shape:     React.createElement render functions (not mustache templates); tokens in separate ES module; framework onClick + DCLogic state
Host artifacts: `support.js` (dc-runtime — GENERATED, DO NOT EDIT), `<x-dc>` wrapper, `<script type="text/x-dc" data-dc-script>`, `<dc-import>` custom elements, `sc-*` CSS classes
Styling:       Inline React style objects via `React.createElement('div', {style: {…}})` combined with a pre-resolved palette object `C` built from shared tokens
Tokens:        12 themes × 3 contrast levels in `ru2gr-tokens.js`; `buildPalette(THEMES, theme, contrast)` resolves per-theme + contrast-aware values
Destinations:  local=inline style in .dc.html render functions, shared=ru2gr-tokens.js (window.RU2GR), theme=THEMES object, derived=buildPalette()
Gate:          npm test && npm run build (in parent project /Users/mymac/development/web/ru2agr_reading)
Render:        none — Tier 1 static check only (these are standalone .dc.html prototypes, not served by parent project dev server)
Naming:        Semantic (paper, ink, muted, blue, terra, green); camelCase JS variables; Russian theme/contrast names (Пергамент, Чёткий)

Styling detail — define:    `THEMES['Пергамент'] = mk({paper:'#ECE7DD', ink:'#272320', …})`
Styling detail — reference: `this.C = this.palette()` → `C.paper`, `C.ink`, `C.muted` etc.

Tokens flow:
  theme name (prop) ─┐
  contrast name (prop) ┘ → buildPalette(THEMES, t, c) → resolved C object → inline style: `style:{background:C.paper, color:C.ink}`

Derived tokens (buildPalette outputs beyond raw THEMES):
  C.content  = elevate(paper, elvAmt*0.30)
  C.card     = elevate(paper, elvAmt)
  C.sidebar  = recess(paper, recAmt)
  C.titlebar = recess(paper, recAmt*1.45)
  C.read     = elevate(paper, elvAmt)
  C.line     = a(ink, dark?0.13:0.09)
  C.line2    = a(ink, dark?0.22:0.16)
  C.cardLine = a(ink, dark?0.18:0.13)
  C.shadow   = dark ? '…' : '0 1px 3px rgba(40,34,22,.10),…'
  C.paper2   = C.card

Font system:
  Serif:  'Gentium Plus', Georgia, serif  (headings, Greek text, body)
  Sans:   'Source Sans 3', system-ui, sans-serif  (UI, labels, navigation)

Duplication detected (reconcile targets):
  1. Google Fonts <link> (preconnect + stylesheet) — identical in all 3 .dc.html files
  2. Base reset CSS (*,html,body,scrollbar,keyframes) — identical in all 3 .dc.html files
  3. `<script src="./support.js">` and `<script src="./ru2gr-tokens.js">` — each file loads independently
  4. `scSheetUp`, `scFade`, `scToast`, `scPop` keyframes — identical across all 3 files

Hardcoded values outside token system (tidy targets):
  1. `ru2gr.dc.html` canvas bar: `background:rgba(207,202,191,0.92)` — hardcoded Пергамент paper with alpha
  2. `ru2gr.dc.html` canvas bar: `border-bottom:1px solid rgba(40,34,22,0.10)` — hardcoded ink at 10%
  3. `ru2gr.dc.html` background: `#cfcabf` — intermediate neutral, not in token system
  4. `ru2gr.dc.html` brand text: `color:#2b2620` — hardcoded ink
  5. `ru2gr.dc.html` subtitle: `color:#9a9488` — hardcoded muted
  6. `ru2gr.dc.html` select text: `color:#5a5246` — hardcoded inkSoft
  7. `ru2gr.dc.html` section labels: `color:#7a7468` and `color:#9a9488`
  8. Mobile frame: `background:#15140f` (phone bezel — intentional, not a design token)
  9. Phone screen background: `background:#ECE7DD` (hardcoded Пергамент paper)
  10. Screen container background: `#f4f2ec`
