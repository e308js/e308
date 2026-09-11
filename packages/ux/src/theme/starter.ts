export const starterTheme = `
.e308-root {
  --e308-bg: #10141c;
  --e308-panel: #1a2230;
  --e308-text: #edf3ff;
  --e308-accent: #78dce8;
  --e308-muted: #afbdd0;
  --e308-border: #ffffff24;
  --e308-danger: #ff7f91;
  --e308-success: #69d99a;
  color: var(--e308-text);
  background: var(--e308-bg);
  font: 16px/1.45 system-ui, sans-serif;
  padding: 1rem;
  min-width: 0;
  overflow-wrap: anywhere;
  box-sizing: border-box;
  max-width: 100%;
}
.e308-root h1 { font-size: clamp(2.35rem, 6vw, 4.5rem); margin: 0 0 .5rem; }
.e308-root h2, .e308-root h3, .e308-root p { margin-block: .4rem .8rem; }
.e308-root *, .e308-root *::before, .e308-root *::after { box-sizing: border-box; }
.e308-stack { display: grid; gap: .75rem; min-width: 0; }
.e308-row { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; }
.e308-quantities { display: flex; flex-wrap: wrap; gap: .5rem; margin-block: 1rem; }
.e308-quantity { font-variant-numeric: tabular-nums; }
.e308-resource, .e308-infobox, .e308-notification {
  background: var(--e308-panel);
  border: 1px solid var(--e308-border);
  border-radius: .55rem;
  padding: .65rem .8rem;
}
.e308-notification { border-inline-start: .25rem solid var(--e308-accent); }
.e308-notification[data-tone="positive"] { border-inline-start-color: #69d99a; }
.e308-notification[data-tone="warning"] { border-inline-start-color: #efc45c; }
.e308-notification[data-tone="danger"] { border-inline-start-color: #ff7f91; }
.e308-root button, .e308-root input, .e308-root select { font: inherit; }
.e308-root button {
  border: 1px solid color-mix(in srgb, var(--e308-accent) 70%, transparent);
  border-radius: .45rem;
  padding: .65rem .8rem;
  background: color-mix(in srgb, var(--e308-panel) 82%, var(--e308-accent));
  color: inherit;
  min-height: 44px;
  min-width: 44px;
  touch-action: manipulation;
}
.e308-root button[data-action] { display: grid; gap: .25rem; text-align: start; }
.e308-root button:not([aria-disabled="true"]):hover { background: color-mix(in srgb, var(--e308-panel) 68%, var(--e308-accent)); }
.e308-root :is(button, input, select, summary, a):focus-visible { outline: 3px solid var(--e308-accent); outline-offset: 2px; }
.e308-root button[aria-disabled="true"] { cursor: not-allowed; opacity: .72; border-color: var(--e308-muted); }
.e308-root button[data-state="pending"] { cursor: progress; opacity: .82; }
.e308-root button[data-state="pending"]::after { content: "Pending…"; color: var(--e308-muted); font-size: .82em; }
.e308-root button[data-state="successful"] { border-color: var(--e308-success); }
.e308-root button[data-state="rejected"] { border-color: var(--e308-danger); }
.e308-root button[data-tone="secondary"] { background: transparent; }
.e308-root button[data-tone="destructive"] { border-color: var(--e308-danger); background: color-mix(in srgb, var(--e308-panel) 82%, var(--e308-danger)); }
.e308-action-description { color: var(--e308-muted); }
.e308-action-description, .e308-action-costs, .e308-action-rewards, .e308-action-blockers { display: block; font-size: .82em; }
.e308-action-costs, .e308-action-rewards { display: flex; flex-wrap: wrap; gap: .75rem; }
.e308-action-costs { color: #e8c985; }
.e308-action-rewards { color: #87dbad; }
.e308-action-blockers { color: #ffc0ca; }
.e308-action-blocker { display: list-item; margin-inline-start: 1.15em; }
.e308-tabs { margin-block: 1rem; }
.e308-tabs > [role="tablist"] { display: flex; gap: .35rem; border-bottom: 1px solid var(--e308-border); max-width: 100%; overflow-x: auto; overscroll-behavior-inline: contain; scrollbar-width: thin; }
.e308-tabs > [role="tablist"] > * { flex: 0 0 auto; }
.e308-tabs > [role="tablist"] button { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.e308-tabs > [role="tablist"] button[aria-selected="true"] { background: var(--e308-accent); color: var(--e308-bg); font-weight: 750; }
.e308-tabs > [role="tabpanel"] { padding-block: 1rem; }
.e308-mark { border-radius: 999px; font-size: .75em; margin-inline-start: .4rem; padding: .1rem .35rem; }
.e308-mark[data-tone="positive"] { background: #1f6f43; }
.e308-mark[data-tone="warning"] { background: #805d08; }
.e308-mark[data-tone="danger"] { background: #8b2635; }
.e308-progress { border: 1px solid var(--e308-border); border-radius: .45rem; height: 1.65rem; overflow: hidden; position: relative; }
.e308-progress-fill { background: var(--e308-accent); display: block; height: 100%; transform-origin: left; transform: scaleX(var(--e308-progress)); }
.e308-progress-label { align-items: center; display: flex; inset: 0; justify-content: center; padding-inline: .5rem; position: absolute; text-shadow: 0 1px 2px var(--e308-bg); }
.e308-progress[data-direction="left"] .e308-progress-fill { transform-origin: right; }
.e308-progress[data-direction="up"], .e308-progress[data-direction="down"] { height: 8rem; width: 1.5rem; }
.e308-progress[data-direction="up"] .e308-progress-fill { transform: scaleY(var(--e308-progress)); transform-origin: bottom; }
.e308-progress[data-direction="down"] .e308-progress-fill { transform: scaleY(var(--e308-progress)); transform-origin: top; }
.e308-progress[data-direction="up"] .e308-progress-label, .e308-progress[data-direction="down"] .e308-progress-label { padding: .2rem 0; writing-mode: vertical-rl; }
.e308-progress-fill[data-animated="true"] { transition: transform .2s linear; }
.e308-grid { display: grid; gap: .4rem; }
.e308-grid-cell { border: 1px solid currentColor; min-height: 3rem; padding: .3rem; }
.e308-grid-cell[data-variant="round"] { border-radius: 999px; }
.e308-tree { max-width: 100%; min-height: 18rem; overflow: auto; position: relative; }
.e308-tree-branches { height: 100%; inset: 0; pointer-events: none; position: absolute; width: 100%; }
.e308-tree-node { position: absolute; transform: translate(-50%, -50%); }
.e308-tree-node[data-ghost="true"] { opacity: .45; }
.e308-tree-node[data-highlight="notification"] { filter: drop-shadow(0 0 .5rem #ffdf6b); }
.e308-tree-node[data-highlight="prestige"] { filter: drop-shadow(0 0 .5rem #ef7cff); }
.e308-particles { min-height: 8rem; overflow: hidden; position: relative; }
.e308-particle { background: transparent; border: 0; position: absolute; }
.e308-input { display: grid; gap: .35rem; grid-template-columns: minmax(0, 1fr) auto; align-items: center; min-width: 0; }
.e308-input input, .e308-input select { grid-column: 1 / -1; }
.e308-input input[type="text"], .e308-input select { min-height: 44px; max-width: 100%; width: 100%; }
.e308-input input[type="range"] { accent-color: var(--e308-accent); min-height: 2rem; width: 100%; }
.e308-input-value { font-variant-numeric: tabular-nums; }
.e308-toggle { align-items: center; cursor: pointer; display: inline-flex; gap: .55rem; min-height: 44px; padding-inline: .35rem; width: fit-content; touch-action: manipulation; }
.e308-toggle .e308-input-label { order: 2; }
.e308-toggle input[type="checkbox"] { accent-color: var(--e308-accent); flex: 0 0 auto; grid-column: auto; height: 1.15rem; margin: 0; width: 1.15rem; }
.e308-toggle:has(input:checked) { color: var(--e308-accent); }
.e308-help { min-width: 0; }
.e308-help-popover { display: inline-block; position: relative; }
.e308-help-trigger { align-items: center; border: 1px solid var(--e308-accent); border-radius: 999px; cursor: pointer; display: inline-flex; font-weight: 800; justify-content: center; min-height: 44px; min-width: 44px; padding: .4rem; touch-action: manipulation; }
.e308-help-trigger::marker { content: ""; }
.e308-help-content { background: var(--e308-panel); border: 1px solid var(--e308-border); border-radius: .55rem; box-shadow: 0 .75rem 2rem #0009; inline-size: min(22rem, calc(100vw - 2rem)); inset-block-start: calc(100% + .35rem); inset-inline-start: 0; padding: .75rem; position: absolute; z-index: 20; }
.e308-help-content a { color: var(--e308-accent); }
.e308-help-expanded { background: var(--e308-panel); border-inline-start: .25rem solid var(--e308-accent); padding: .75rem; }
.e308-section { min-width: 0; }
.e308-section > :is(h2, h3, h4):first-child { margin-block-start: 0; }
.e308-section-card { background: var(--e308-panel); border: 1px solid var(--e308-border); border-radius: .65rem; padding: clamp(.75rem, 2vw, 1rem); }
.e308-section-status-strip { backdrop-filter: blur(.5rem); background: color-mix(in srgb, var(--e308-bg) 90%, transparent); border-block-end: 1px solid var(--e308-border); inset-block-start: 0; padding: .45rem .65rem; position: sticky; z-index: 10; }
.e308-fieldset { border: 1px solid var(--e308-border); border-radius: .55rem; display: grid; gap: .75rem; margin: 0; min-width: 0; padding: .8rem; }
.e308-fieldset > legend { color: var(--e308-accent); font-weight: 700; padding-inline: .3rem; }
.e308-action-group { align-items: stretch; display: flex; flex-wrap: wrap; gap: .6rem; }
.e308-feedback { border: 1px solid var(--e308-border); border-inline-start: .3rem solid var(--e308-accent); border-radius: .5rem; background: var(--e308-panel); padding: .65rem .8rem; }
.e308-feedback[data-state="success"] { border-inline-start-color: var(--e308-success); }
.e308-feedback[data-state="failure"] { border-inline-start-color: var(--e308-danger); }
.e308-feedback-message { margin: 0; }
.e308-error-summary { margin-block-end: 0; padding-inline-start: 1.25rem; }
.e308-feedback a { color: var(--e308-accent); }
.e308-feedback-banner { inset-block-start: .5rem; margin-inline: auto; max-width: 48rem; position: sticky; z-index: 30; }
.e308-feedback-toast { inset-block-start: 1rem; inset-inline-end: 1rem; max-width: min(24rem, calc(100vw - 2rem)); position: fixed; z-index: 100; }
.e308-save, .e308-offline { color: var(--e308-muted); font-size: .875rem; }
@media (max-width: 40rem) {
  .e308-root { padding: .75rem; }
  .e308-action-group > button { flex: 1 1 10rem; }
  .e308-help-content { inset-inline-start: auto; inset-inline-end: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .e308-root *, .e308-root *::before, .e308-root *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
  .e308-progress-fill { transition: none; }
}
`;
