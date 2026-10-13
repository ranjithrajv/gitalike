# Popup motion honours prefers-reduced-motion and animates cheaply

> **Executed.** The three transitions now live in one
> `@media (prefers-reduced-motion: no-preference)` block, `background` became
> `background-color`, and every curve is `ease-out`. 349 tests pass, `oxlint`
> clean, `oxfmt --check` clean. See **Reconciliation** for the verification
> caveat (no suite asserts popup CSS today).


Written against: `43920d2a369131b14070d3766357ee7fdaab2d5a`

## Evidence chain

- Surface: the extension popup — `src/popup/popup.css` — which is where the user picks a skin, adds a host and toggles the per-host theme.
- Problem: the popup's three motion declarations run for every user, with no reduced-motion guard, and one of them animates a paint property.
- Design evidence, the complete list of transitions in the product (`grep -rn 'transition\|animation\|@keyframes' src/themes/*.css src/popup/popup.css` returns exactly these three; the skin stylesheets contain none):

  | Location | Declaration | Issues |
  | --- | --- | --- |
  | `src/popup/popup.css:130` (`.add__chevron`) | `transition: transform 120ms ease;` | compositor-friendly ✔, duration ≤ 200ms ✔, no reduced-motion guard ✘, `ease` rather than `ease-out` on what reads as a reveal ✘ |
  | `src/popup/popup.css:285` (`.switch__track`) | `transition: background 120ms ease;` | `background` is the shorthand — it animates image, position and size along with colour, and is a paint property, not a compositor property ✘; no reduced-motion guard ✘ |
  | `src/popup/popup.css:296` (`.switch__knob`) | `transition: transform 120ms ease;` | compositor-friendly ✔, no reduced-motion guard ✘ |

  The durations (120ms) are already inside the ≤ 200ms interaction-feedback budget, and `transform` is the right property for a knob and a chevron, so the defects are narrow: the missing guard, the shorthand, and the curve.
- Owner: `src/popup/popup.css`. No other file in the product animates.
- Scope and affected surfaces: the popup only — the chevron rotation on the "add host" row, and the theme switch's track and knob.
- Uncertainty: none. The three declarations, their properties and the absence of any media query are directly observable, and no product behaviour depends on the animation running.

## Design decision

Wrap the three declarations in a `@media (prefers-reduced-motion: no-preference)` block so users who ask for reduced motion get the state change with no movement at all, and tighten the declarations themselves: `background` → `background-color`, `ease` → `ease-out`. Preferring the opt-in form (`no-preference`) over a `reduce` override that sets `transition: none` keeps the "no motion unless asked for" default and leaves the file readable — the reduced-motion path is then the absence of a transition, which is the smallest possible code.

## Reuse

- The three existing selectors and their duration/curve values; no new tokens, no new keyframes, no animation library (the project has no motion runtime and does not need one for two 120ms state transitions).
- Exemplar for a focus/motion-quality pass already present in this file: `src/popup/popup.css:153`, `:209`, `:386`, `:453`, `:475`, `:504`, `:533` all use `:focus-visible` correctly, so the popup's interaction-quality conventions are established and this plan only brings motion up to the same bar.
- Exemplar for a media-query block scoped to enhancement: `src/plugins/skins/*/as-*.css` will gain `@media (forced-colors: active)` blocks in the companion plan, so a progressive-enhancement media block is an established pattern by the time both land.

## Changes

1. `src/popup/popup.css:126-131` (`.add__chevron`)
   - Change: move the `transition: transform 120ms ease;` declaration into a `@media (prefers-reduced-motion: no-preference) { … }` block containing the chevron's rule, and change the curve to `ease-out`.
   - Preserve: the selector, `flex: none`, `font-size: 13px`, `line-height: 1`, and the "plus becomes a cross" rotation itself (`transform` on the checked/expanded state).
   - Verify: with the OS set to reduce motion, opening the add-host row moves the chevron instantly; otherwise it still rotates over 120ms.

2. `src/popup/popup.css:283-287` (`.switch__track`)
   - Change: move the declaration into the same media block and change `background` to `background-color`.
   - Preserve: `width: 34px`, `height: 20px`, `border-radius: 999px`, `background: var(--border)`, and the checked-state colour change.
   - Verify: the track still changes colour when the switch toggles, in both motion settings, with no layout or image animation.

3. `src/popup/popup.css:293-297` (`.switch__knob`)
   - Change: move the declaration into the same media block and change the curve to `ease-out`.
   - Preserve: the knob geometry, `background: #ffffff`, `box-shadow`, and the `.row:has(.switch:checked) .switch__track` sibling rule that follows.
   - Verify: the knob still slides, and does not slide when reduced motion is requested.

4. Single media block
   - Change: keep one `@media (prefers-reduced-motion: no-preference)` block holding all three rules rather than three separate blocks, so the "motion is an enhancement" intent is stated once.
   - Preserve: existing rule ordering where a rule's cascade position matters (the switch rules depend on `:has()` state rules that must keep their order).
   - Verify: `grep -c 'prefers-reduced-motion' src/popup/popup.css` returns 1 and `grep -c 'transition' src/popup/popup.css` returns 3.

## Scope

- Inherit: any future popup motion — it belongs inside the same block.
- Verify: `.switch__track`'s `background: var(--border)` shorthand declaration is untouched (it is a colour set, not an animation, and splitting it would change the cascade); the `:focus-visible` rules are untouched.
- Exclude: the skin stylesheets (they contain no animation — adding reduced-motion blocks there would be dead code); any new motion, any motion library, any change to the switch's `:has()` state logic or to keyboard behaviour.

## Validation

- Product: toggle the theme switch and expand the add-host row in the popup with (a) motion enabled and (b) "reduce motion" set at the OS level.
- Interface: Chromium and Firefox with `prefers-reduced-motion: reduce` emulated in devtools; keyboard-only operation (Tab to the switch, Space to toggle) to confirm focus is unaffected; the popup at its narrowest and widest.
- System: `grep -n 'transition' src/popup/popup.css` shows all three inside the media block; no `transition` remains at top level.
- Repository: `npm run fmt:check` and `npm run lint:js` pass; `npm test` passes (no suite asserts popup CSS today, so also confirm by opening the popup from a built `dist/chromium`).

## Stop conditions

- Stop if the popup already relies on a transition end event anywhere in `src/popup/popup.js`: then removing the transition for reduced-motion users would break logic, and the plan needs a JS guard first.
- Stop if a maintainer wants the motion to persist for reduced-motion users as a deliberate product decision: keep the transitions unguarded and record the exception with the measured durations beside the declarations.

## Design documentation

- After acceptance and validation: record in `src/popup/popup.css` (a one-line comment above the media block) that the popup animates only under `prefers-reduced-motion: no-preference`, uses compositor properties only, and stays under 200ms — so the next motion change inherits the rule rather than rediscovering it.

## Reconciliation (execution note)

**Verification performed:**
- `grep -n 'transition' src/popup/popup.css` → three hits, all inside
  `@media (prefers-reduced-motion: no-preference)` (lines 569, 573, 577); no
  top-level transition remains.
- `grep -c 'prefers-reduced-motion' src/popup/popup.css` → 1.
- `npm test` → 349 tests; `npm run lint:js` and `npm run fmt:check` → clean.

**Caveat recorded:** no suite asserts popup CSS, so the rendered behaviour is
unverified by anything other than inspection. The stop condition about a
`transitionend` listener was checked by reading `src/popup/popup.js` before
editing: it has no `transitionend` / `animationend` listener
(`grep -n 'transitionend\|animationend' src/popup/popup.js` returns nothing),
so removing the transition for reduced-motion users cannot break logic.
Open the built popup with the OS set to reduce motion to confirm the state
change is instant.
