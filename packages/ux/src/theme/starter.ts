export const starterTheme = `
.e308-root {
  --e308-bg: #10141c;
  --e308-panel: #1a2230;
  --e308-text: #edf3ff;
  --e308-accent: #78dce8;
  --e308-muted: #afbdd0;
  --e308-border: #ffffff24;
  color: var(--e308-text);
  background: var(--e308-bg);
  font: 16px/1.45 system-ui, sans-serif;
  padding: 1rem;
}
.e308-root h1 { font-size: clamp(2.35rem, 6vw, 4.5rem); margin: 0 0 .5rem; }
.e308-root h2, .e308-root h3, .e308-root p { margin-block: .4rem .8rem; }
.e308-stack { display: grid; gap: .75rem; }
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
}
.e308-root button[data-action] { display: grid; gap: .25rem; text-align: start; }
.e308-root button:not(:disabled):hover { background: color-mix(in srgb, var(--e308-panel) 68%, var(--e308-accent)); }
.e308-root button:focus-visible { outline: 3px solid var(--e308-accent); outline-offset: 2px; }
.e308-root button:disabled { opacity: .55; }
.e308-action-description { color: var(--e308-muted); }
.e308-action-description, .e308-action-costs, .e308-action-rewards, .e308-action-blockers { display: block; font-size: .82em; }
.e308-action-costs, .e308-action-rewards { display: flex; flex-wrap: wrap; gap: .75rem; }
.e308-action-costs { color: #e8c985; }
.e308-action-rewards { color: #87dbad; }
.e308-action-blockers { color: #efb0ba; }
.e308-tabs { margin-block: 1rem; }
.e308-tabs > [role="tablist"] { display: flex; flex-wrap: wrap; gap: .35rem; border-bottom: 1px solid var(--e308-border); }
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
.e308-progress-fill[data-animated="true"] { transition: transform .2s linear; }
.e308-grid { display: grid; gap: .4rem; }
.e308-grid-cell { border: 1px solid currentColor; min-height: 3rem; padding: .3rem; }
.e308-grid-cell[data-variant="round"] { border-radius: 999px; }
.e308-tree { min-height: 18rem; position: relative; }
.e308-tree-branches { height: 100%; inset: 0; pointer-events: none; position: absolute; width: 100%; }
.e308-tree-node { position: absolute; transform: translate(-50%, -50%); }
.e308-tree-node[data-ghost="true"] { opacity: .45; }
.e308-tree-node[data-highlight="notification"] { filter: drop-shadow(0 0 .5rem #ffdf6b); }
.e308-tree-node[data-highlight="prestige"] { filter: drop-shadow(0 0 .5rem #ef7cff); }
.e308-particles { min-height: 8rem; overflow: hidden; position: relative; }
.e308-particle { background: transparent; border: 0; position: absolute; }
.e308-input { display: grid; gap: .35rem; grid-template-columns: 1fr auto; align-items: center; }
.e308-input input, .e308-input select { grid-column: 1 / -1; }
.e308-input input[type="range"] { accent-color: var(--e308-accent); min-height: 2rem; width: 100%; }
.e308-input-value { font-variant-numeric: tabular-nums; }
.e308-save, .e308-offline { color: var(--e308-muted); font-size: .875rem; }
@media (prefers-reduced-motion: reduce) {
  .e308-progress-fill { transition: none; }
}
`;
