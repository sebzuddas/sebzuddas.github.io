# Implementation requirements for Claude Code

Companion to `CONTEXT-PACK.md` (what the site is for, routes, redirects, the Substack pipeline) and
`ART-DIRECTION.md` (the visual constraints). This document covers what the first pass proved, what
must be frozen before code is written, and the quality bar a build is measured against.

Source: Claude Design's first pass, `seb-zuddas-landing.html`, 211 KB, inspected 30 Oct 2026.

---

## 1. What the first pass actually contains

Verified from the file and from rendering it:

| | |
| --- | --- |
| Directions | 6, each a root class `d1` to `d6`, each with its own complete CSS section |
| Palettes | 23, of which 3 to 4 belong to each direction |
| Layouts | 3 (`plate`, `bench`, `paper`), defined per direction |
| Font stacks | 6, so a direction also changes the type |
| Instrument | a Kuramoto synchronisation rig: 160 oscillators, coupling `K`, order parameter `r`, a PI controller holding `r` on a setpoint, a 30 second chart recorder, and a loop open/closed switch |
| Structure | one self-contained file, 211 KB on disk, 2 script tags, no runtime libraries |
| Drawing | 4 canvases (three 355px square panels in a stack, one 681x341 recorder strip) plus 15 SVGs |
| Rendering | no horizontal overflow at 390px or 2560px |

**What it is, precisely: a comparison instrument, not a website.** Six complete design systems in one
file is exactly the right artefact for choosing, and it is unbuildable as a site.

### What is worth keeping

- **The idea of a live system under feedback, not its subject.** The first pass produced coupled
  oscillators with a controller holding coherence. The owner has replaced that subject with a
  cascade network (section 3), but the pattern stays: a system visibly alive, held by a controller,
  with honest consequences when the loop opens.
- **The recorder strip**: a rolling 30 second window with two channels, so the reader sees history
  and parameters at once. That is the right pattern for every instrument on the site.
- **The loop open/closed switch**: an honest, one-click demonstration of what feedback does. This is
  the "play" model expressed as a single control.
- **The per-palette noise texture** (an inline `feTurbulence` data URI) is the cheapest way to stop a
  flat fill reading as a web page.
- **The chassis architecture in `d6`**: `--rack`, `--plate`, `--screw`, and a `.screws` class, with
  each bay setting its own palette locally. The comment in the file says it: these are chassis
  colours, each bay sets its own palette. That is the correct structure.
- **The foundation tokens**: `--s-1` to `--s-8`, `--gutter`, `--col-gap`, `--rule`, `--radius`,
  `--t-fast`, `--ease`. Keep them.

### Defects to fix or remove

1. **A design annotation leaked into the page as CSS content.** `.d5 .ctl::after { content: "the
   controls ↘" }` still computes to that string when direction 5 is active, so those words can be
   painted onto the page. Any build must ship a check for stray generated content.
2. **Unit sloppiness in the readouts.** Coupling `K` and critical coupling `Kc` are presented in
   rad/s. For a Kuramoto model that is dimensionslly defensible, but a critical value shown without
   saying it is normalised against the frequency spread is the first thing an engineer will query.
   Show `K/Δω` as dimensionless, or state the normalisation on the panel.
3. **Six directions and 23 palettes inside one 211 KB file.** Must decompose into a token layer, a
   component layer and per-instrument scripts.
4. **Off-brand type in places**: a script face (Yellowtail) and a display face (Michroma) drift into
   pastiche. Stencil is defensible for machine markings only, never for body or headings.
5. **An emoji in the `<title>`**, which leaks into the browser tab, search results and link previews.
6. **Six Google Font families** across the file in six separate requests. The shipped site uses one
   stack: two families, or three if the mono is counted separately.

---

## 2. The identity decision, and how to support it without six stylesheets

Classical control styled as the atomic age and digital control styled as the 1980s sounds right and
is the wrong mechanism, because **the era belongs to the instrument, not to the section.** A section
boundary is organisational, and a reader arriving from search never learns the taxonomy: they see
the type and the furniture change mid-site and read it as inconsistency. An instrument boundary is
material, and a 1950s analogue rig and an 1980s vector display are genuinely different objects, so
the same reader reads the change as meaning.

The rule to build on:

- **One identity, one chassis.** Page grid, type scale, spacing rhythm, navigation, link behaviour,
  footer and motion tempo are identical everywhere.
- **Materials are per instrument.** Two or three named materials, not six: `phosphor` (a CRT),
  `plotter` (a paper sheet), `blueprint` (a drafting sheet), `panel` (stencilled metal). An
  instrument declares one, and inherits everything else.
- **The era never touches the furniture.** Nav, headings, body copy and footer wear the chassis, so
  the site always reads as one machine holding several instruments.

**Token architecture, so a variant costs one file and never a component:**

```
tokens/foundations.css     space, type scale, radii, rules, motion tempo
tokens/chassis.css         the shipped identity: surfaces, ink, borders, links, furniture
tokens/materials/*.css     phosphor.css, plotter.css, blueprint.css, panel.css
components/*.css           consume SEMANTIC tokens only
```

A component may reference `--screen-bg`, `--screen-ink`, `--surface`, `--ink`, `--accent`. **A
component may never reference a palette name, a direction name or a material name.** That single
rule is what makes themes swappable without touching a component, and what makes their removal
cheap later.

**On a viewer-facing switch: no.** Four reasons, in order of weight:

1. Six shipped themes means every future component must be visually verified in six contexts,
   forever. That is precisely the tending the owner does not want.
2. A visible theme switch tells the reader the identity is arbitrary, which contradicts the point of
   having one.
3. It asks the reader to make a decision they did not come for.
4. It makes the token layer's completeness a permanent correctness burden instead of a design
   choice.

Keep instead: **at most one visible toggle** (light and dark, which readers expect and which the
paper and chassis palettes already support), and **a development-only switch** (`?theme=name`, plus a
keyboard shortcut) so the alternatives can be inspected at any time without shipping a chooser. Keep
the token layer capable of six themes, ship one identity.

---

## 3. The hero instrument: freeze the model

The owner replaced the cascade network with a Falcon 9 landing game, and later removed the cascade rig
from the site in favour of the convolution tool at `/resources/tools/convolution/`.

**Modes.** Three, shown as "Autopilot status": On, full model predictive control, which is the default
and lands on its own; Assisted, the visitor flying with assistance; Manual, the visitor flying open
loop. Choosing a mode restarts the flight. Keys steer only while the visitor is flying, so on the
default the page still scrolls.

**Dimensions.** 3D only, with no 2D option. A ground ring under the booster gives the depth cue.

**Vehicle.** A wireframe Falcon 9 booster: nine engines, four grid fins and four legs. The legs start
out below 80 m and take 2 s. They do not change the flight.

**Keyboard.** The right panel shows the keys in their real inverted T, labelled with what each does
in the current mode. There are two clusters: W and S hold the throttle and the up and down arrows
steer the second axis. The keys
are also the touch controls, and light up when pressed.

**Model.** Rigid body in `x`, `y`, `z` and tilts `θ` and `φ`, with the two sideways axes treated independently. Fixed step 0.02 s. Thrust 15.7
m/s² at start mass, throttle off or 40 to 100%, gimbal ±0.26 rad, quadratic drag, fuel burn changing
mass. Starts after the flip, at 620 to 740 m, near vertical, seeded.

**Controller.** Height and lateral motion are planned by separate receding-horizon MPCs on a double
integrator: 24 steps of 0.25 s, replanned at 5 Hz, each a box-constrained QP solved in the browser by
accelerated projected gradient, with no solver library. An attitude loop turns the planned
acceleration into gimbal. Assistance tracks the visitor's requested speeds, with lateral authority
shrinking with height. Weights are frozen in `TUNING` in `src/tools/falcon-9/model.ts`.

**Landing limits.** Under 3 m/s vertical, 2 m/s lateral, 6 degrees of tilt, inside the 20 m pad.

**Honesty.**

- The autopilot is real MPC, not a recorded path. The dashed line on screen is its live plan.
- It must land from all 60 test starts. Assistance must land a pilot who steers at the pad, and must
  miss if the pilot does nothing. Doing nothing in open loop must crash.
- Free fall matches the closed form with quadratic drag within 1%. QP solutions satisfy the
  optimality conditions.
- The notes state what the model leaves out, and that the site is not affiliated with SpaceX.

**Readouts.** Status, altitude, vertical and lateral speed, tilt, throttle, fuel, `t`, plus forward
speed in 3D. Numbers on every instrument use seven-segment displays in DSEG7, with unlit segments
faintly visible. Words stay in the mono face. The recorder is
a 30 second window of CH1 descent speed and CH2 throttle. The lamp shows when MPC is engaged.

**Guards.** Fixed timestep, seeded starts, DPR cap of 2, reserved canvas box, pause when hidden or
offscreen. Under `prefers-reduced-motion` the page shows one static frame with true readouts, and
motion starts only when the visitor presses Fly. If WebGL fails, the panel says so and the page
still works. Mode and seed are in the URL hash.

## 4. Instrument realism: the anti-bland checklist

A flat rectangle with a border and a graticule reads as a wireframe, and both the owner and an
independent review said so. Everything below is cheap, and most of it is CSS rather than canvas.

1. **Glass inset into the chassis, not bordered.** A 6 to 10px bezel in the metal token, with a dark
   1px line where the glass meets it, an inset shadow top-left inside the screen, a hairline
   highlight along the lower outer edge, and a soft outer drop shadow so the panel sits proud.
2. **Emission.** Draw every trace twice: a wide, low-opacity blurred pass and a crisp pass. On
   canvas, `shadowBlur` plus a second stroke does it. This is what makes phosphor look like phosphor.
3. **Afterglow.** Keep the previous samples at decreasing alpha. It is physically right and it makes
   the trace feel alive in a way no static line does.
4. **Scan structure.** Horizontal scanlines at 2 to 3px pitch and 4 to 6% contrast, plus one slow
   refresh band travelling the panel over 8 to 12 seconds, linear and infinite. Same technique as the
   reference site, same cost.
5. **Graticule with hierarchy.** Major and minor divisions at different weights, a brighter centre
   cross, ticks every tenth division, and the numbers printed on the bezel rather than floating on
   the glass.
6. **Furniture.** Corner screws (the class already exists), a maker's plate with a model number, a
   legend strip carrying the channel names and ranges, a power lamp that lights when the loop is
   closed, and a serial number somewhere small.
7. **Idle life.** With nobody touching it, the instrument shows something slow and physically
   meaningful: a mode beating, a slow precession, a sweep. A frozen trace is a screenshot.
8. **Signs of use.** A paper label taped to the panel with a hand-marked setpoint. This is the
   authenticating detail the atomic-age direction lacked: it read as pastiche because nothing about
   it looked used.
9. **No perspective transform on the live page.** Tilting the whole rack looks wonderful in a
   mockup and blurs text, harms accessibility and breaks hit targets. If perspective is wanted, put
   it inside the instrument's own artwork only.
10. **Legibility beats the cliché.** No curvature heavy enough to bend text, no chromatic aberration
    strong enough to blur a numeral, no scanlines over body copy.

---

## 5. Motion

- Sinusoids at fixed frequencies with phase offsets between elements. Never random, never drifting.
- One animated thing per page. Everything else is still.
- Loops of 8 to 16 seconds, linear, infinite. Fast loops read as a toy.
- Motion shows a system doing something: a mode, a response, a convergence, a lock. If it is not
  showing a system, it is decoration and it goes.
- `prefers-reduced-motion: reduce` disables it and the page keeps every piece of information it had.
- No scroll-jacking, no universal fade-ins, no parallax.

## 6. Type

One stack, three roles: display, text, mono. Two families, or three if the mono is counted
separately. Mono for every number, unit, parameter and axis label, and never for prose. Stencil
lettering only for machine markings. No script faces. Self-host or make a single font request, and
never ship six.

## 7. Components to build once

Chassis bar (identity, nav, links out to wiki and Substack), rack panel (the bezel and glass
wrapper), instrument (a slot for any simulation with its controls, readouts and recorder), control
cluster, readout strip, recorder strip, project card, resource row, signup strip, footer, and the
plate and screw furniture. Every one themed by tokens, every one verified in every shipped theme.

## 8. What the build must not do

- Invent a simulation model beyond section 3, or change the model's parameters without approval.
- Add a runtime library to an instrument without approval. Three.js is approved for the Falcon 9
  hero, lazy-loaded and framed. Any other 3D instrument is approved individually, and only where the
  subject genuinely is three-dimensional.
- Reference a palette, direction or material name inside a component.
- Ship more than one identity, or any theme chooser beyond the single light and dark toggle.
- Carry over emoji, stock icons, stock photography, invented metrics or placeholder copy.
- Use anything from the Engineering Excellence brand: its typefaces, its gold, its marks.
- Change published copy without approval, and never introduce an em dash.

## 9. Acceptance tests

1. No horizontal scroll at 390, 768, 1440 and 2560.
2. The instrument holds 60fps on a mid-range laptop, and CPU falls to near zero when scrolled
   offscreen or when the tab is hidden.
3. Under reduced motion the instrument renders a correct static frame and reports accurate readouts.
4. A permalink round-trips exactly: reload restores the identical state and the identical plot.
5. The three modes behave as section 3 requires, and the lamp shows when MPC is engaged.
6. Free fall matches the closed form within 1%.
7. No cumulative layout shift from the canvas, and the largest contentful paint is text.
8. JavaScript loaded with the page under 40 KB gzipped. The lazy 3D instrument under 220 KB gzipped.
9. A test that fails if any `::after` content is not a design intention, to catch the class of bug
   found in the first pass.
10. Contrast checked per shipped theme, not once.

## 10. Decisions frozen

1. **Identity**: the atomic-age chassis (Googie, retro-future) with per-instrument materials. This
   replaced the rack chassis. Original motifs only: no marks, characters or names from any game.
2. **Materials**: `phosphor`, `blueprint`, `plotter`. `panel` stays out until an instrument needs it.
3. **The hero instrument**: the Falcon 9 landing game in section 3.
4. **Type stack**: Jost, Yellowtail, IBM Plex Sans and Courier Prime, self-hosted.
5. **Shipped palettes**: `walnut` for dark and `paper` for light.
6. **The light and dark toggle**: yes.

## Before cutover

The About poster (`public/assets/img/about-poster.jpg`) is a stand-in. Its emblem closely resembles Vault-Tec's, and the site otherwise uses original motifs only. Replace it with an original-emblem version before this deploys.
