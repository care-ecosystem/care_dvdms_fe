# Care Frontend Plugin Template

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/care-ecosystem/care_fe_plugin_template)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.x-blue.svg)](https://react.dev/)
[![eGov Foundation](https://img.shields.io/badge/eGov-Foundation-orange.svg)](https://egov.org.in)

A starter template for building CARE frontend plugins using React + TypeScript + Module Federation.

**Developed by**: [eGov Foundation](https://egov.org.in)

## Quick Links

- 🔧 **Backend Template**: [care_plugin_template](https://github.com/care-ecosystem/care_plugin_template)
- 📖 **CARE Frontend**: [ohcnetwork/care_fe](https://github.com/ohcnetwork/care_fe)
- 🐛 **Report Issues**: [GitHub Issues](https://github.com/care-ecosystem/care_fe_plugin_template/issues)
- 🏢 **eGov Foundation**: [egov.org.in](https://egov.org.in)
- 📧 **Contact**: [jagan.kumar@egovernments.org](mailto:jagan.kumar@egovernments.org)

## Getting Started

### 1. Use this template
Click **Use this template** on GitHub to create your repo.

### 2. Rename the plugin
Search and replace `care_myplugin` → `care_yourplugin` across all files.
Update `package.json` name, `vite.config.ts` federation name, and `manifest.tsx` plugin key.

### 3. Install dependencies
```bash
npm install
```

### 4. Start development
```bash
npm run dev
```
This builds and watches — your plugin is served at `http://localhost:5177/assets/remoteEntry.js`.

### 5. Register with care_fe
In your care_fe environment config, add:
```
http://localhost:5177/assets/remoteEntry.js
```

## Architecture

| File | Purpose |
|------|---------|
| `src/manifest.tsx` | Plugin registration: routes, navItems, components, i18n |
| `src/routes.tsx` | URL → component mapping |
| `src/apis/` | Typed HTTP client (auth, GET, POST, PATCH, DELETE) |
| `src/types/` | TypeScript types matching backend specs |
| `src/hooks/` | React Query hooks for API calls |
| `src/pages/` | Full page components |
| `src/components/pluggables/` | Components injected into care_fe via `manifest.components` |
| `src/lib/` | Shared utilities and constants |

## Module Federation

This plugin exposes a single entry point:
```
./manifest → src/manifest.tsx
```

care_fe loads `remoteEntry.js` at runtime and reads the manifest to wire up routes, nav items, and pluggable components.

## Manifest Extension Points

| Key | Purpose | Example |
|-----|---------|---------|
| `routes` | URL patterns handled by this plugin | `/facility/:facilityId/notes` |
| `navItems` | Links in the main sidebar | Patient-facing nav |
| `adminNavItems` | Links in the admin sidebar | Config pages |
| `encounterTabs` | Tabs added to the Encounter detail page | Clinical data |
| `components` | Pluggable components injected by care_fe | Action buttons |
| `i18n` | Translation strings | `{ en: { key: "Label" } }` |

## Deployment

Deploy to Cloudflare Workers:
```bash
npm run build
npx wrangler deploy
```

Or to GitHub Pages via the included `deploy.yml` action — triggers automatically on push to `main`.

## GitHub Actions

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`.
Set up **GitHub Pages** in your repo settings (Settings → Pages → Source: GitHub Actions).
