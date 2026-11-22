# care_dvdms_fe

CARE frontend plugin. PRs are reviewed by care_ci; the rules live in
`care-ecosystem/care_reviewer`. Keep this file under 60 lines — it is read on every review run.

## Identity
**These four do not all agree.** Only `PLUGIN_SLUG` is load-bearing — the host keys this
plugin's runtime config by it, and a registered name that does not match makes every config key
fall back to its default with no error and no warning.

- `PLUGIN_SLUG`: `care_dvdms_fe` — in `src/lib/constants.ts` (note: not `src/constants.ts`)
- vite `federation({ name })`: `care_dvdms` — controls shared-dep scope and the CSS global only
- manifest `plugin:`: `care_dvdms` — cosmetic
- `package.json` name: `care_dvdms_fe` — no runtime effect

Read the slug from `src/lib/constants.ts`. Do not infer it from the vite config or the manifest;
both say `care_dvdms` and both are wrong for that purpose.

## Entry points
`src/manifest.tsx` exposes:
- `components`: `FacilityHomeActions`
- `overrides`: `RequestOrderShow` → `RequestOrderShowDvdmsFooter`, priority 10, matched by route
  regex and gated on `?flow=dvdms` inside the component (raviger's `usePath` drops query params,
  so the condition cannot see them). Must be **appended** to the deployment's
  `REACT_MFE_REGISTERED_COMPONENTS`, never assigned over it.
- `navItems`: DVDMS
- `routes` from `src/routes.tsx`

## Integrates with
- Backend plugin: `care_dvdms` (`/api/care_dvdms/`), which in turn talks to the external DVDMS
  system. Anything here that triggers an order or delivery write is on that path.
- Shared singletons in `vite.config.mjs`: react, react-dom, react-i18next,
  @tanstack/react-query, raviger, sonner

## Deliberate deviations
- (none recorded)
