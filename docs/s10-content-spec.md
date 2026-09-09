# S10 finished-game content and evidence contract

Status: frozen before finished-game implementation. Content version `1.0.0` changes only through a
recorded spec revision.

## Shared acceptance shape

Wireworks, Cascade, and Hearth are separate private workspace packages. Each package imports only
published `@e308/core` and `@e308/ux` entry points, owns its mechanics and view projection, and builds
as a consumer of packed release-candidate archives. Every package exports its definition, legal
intent dispatcher, view projection, harness scenario, and new-game constructor.

Each game ships instructions, a visible ending, beginning/middle/end checkpoint fixtures, a scripted
winning policy, a ranked policy, and a goal policy. The acceptance runs cover active, intermittent,
and long-absence schedules. Save round trips and the disabled, eight-hour fixed-cap, state-derived
dynamic-cap, and unlimited offline policies cover absences of 0, 1 minute, 1 hour, 8 hours, 1 day,
and 30 days at all three checkpoints. All replay, worker, and render-rate comparisons use identical
seeds, commands, and elapsed durations.

The designed completion horizon is 12 game-hours for Wireworks, 72 game-hours for Cascade, and one
four-season year (24 game-minutes) plus 12 game-minutes of recovery for Hearth. Headless winning
scripts may wait directly between decisions; they may not edit saves, call transactions outside
commands, or change content coefficients.

## Wireworks 1.0.0

Wireworks has workshop, powered-industry, and autonomous-expansion eras. Its stocks are cash, matter,
wire, clips, power, demand, drones, and probes. Manufacturing and sales remain separate: machines
consume matter/power into inventory, while revision-bound market commands convert inventory into
cash. Three quoted price bands trade margin against bounded demand.

The ordered projects are bench tools, storefront, demand survey, powered extrusion, battery bank,
assembler line, price model, autonomous control, drone swarm, orbital contract, launch array, and
final expansion. Projects change production, capacity, available controls, or the economic phase.
After price model, the player makes the mutually exclusive durable-drive or high-throughput story
choice. The final expansion requires autonomous production, an orbital stockpile, and one choice;
buying it once is the ending.

The two comparison strategies are high-price conservation and low-price volume. Evidence records
their inventory, cash, matter, and completion-time differences. PC01 maps manufacturing/sales,
PC02 maps matter and power constraints, and PC03 maps powered extrusion's once-only phase change and
its retired workshop controls.

## Cascade 1.0.0

Cascade uses the break-eternity adapter. Eight purchased/generated tiers produce downward from tier
eight to tier one and then currency. Each tier has a geometric purchase curve and a buy-ten
milestone. The game includes a normal collapse, a static condense, and an ascension reset over a
higher scope. Quantities above `1e308` must occur in the legal completion trace and survive save
round trips.

Six challenges cover slowed base production, reversed emphasis, scarce purchases, reset pressure,
automation limits, and a composite trial. The scarce and automation trials can run together; the
composite counts as both. At least one challenge earns multiple completion tiers. Research points
can be allocated between speed and retention and fully respeced through a documented public-command
extension. Tier-one buying and collapse automation can be enabled independently.

The ending requires all reset levels, every challenge reward, a completed respec, and final research.
The comparison strategies prioritize early collapse or producer depth. Evidence records reset count,
challenge order, and completion-time differences.

## Hearth 1.0.0

Hearth tracks workers, food, wood, stone, science, herbs, tools, meals, cloth, and morale. Workers
allocate among farmer, woodcutter, miner, and scholar jobs. Spring, summer, autumn, and winter each
last six game-minutes and change the independently checked seasonal ledger. Storehouses impose
capacity pressure.

Six recipes and four research unlocks form the ten-step craft/research floor. Two paid tasks reserve
inputs and deliver outputs after time. A food shortage causes an explicit morale loss and event; a
legal recovery route reallocates workers, prepares meals, and restores morale. The final settlement
objective requires one complete calendar cycle, the shortage and recovery events, all four research
unlocks, and the hall task's delivered claim.

The comparison strategies stockpile before winter or specialize in research. Evidence records
seasonal food minima, blocked capacity, task timing, and recovery duration.

## Views and reference laboratories

Wireworks uses changing control panels with retired-era narrative; Cascade uses dense tables plus an
optional positioned progression tree; Hearth uses a settlement/workforce dashboard and calendar.
All important actions show costs and blockers and support keyboard and touch. Wireworks also renders
through a deliberately different compact terminal view over the same save. A supplied control is
replaced in one host and Hearth renders a custom seasonal-ledger view.

The browser gallery adds interactive Antimatter Dimensions and Kittens Game laboratories over the
already pinned, independently compared AD01–AD06 and KG01–KG06 subjects. The laboratories expose
source case selection, legal actions, current normalized state, save round trip, and blockers. They
carry source attribution and make no full-game parity claim.

These reference laboratories are private verification tools. The public library site includes
playable Wireworks, Cascade, and Hearth and does not publish the laboratories or any cloned/reference
game as an e308 example.

## Review and release evidence

CI records completion traces, checkpoints, policy/schedule reports, the offline/recovery matrix,
browser accessibility assertions, package-consumer builds, reference-laboratory results, and final
content performance workloads. Automated evidence does not stand in for the required walkthrough:
S10 remains unaccepted until a person other than the implementer records completion/review of all
significant choices and both desktop and touch interaction.
