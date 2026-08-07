/** @type {import('tailwindcss').Config} */
export default {
  // Scopes every generated utility to require this ancestor class, and
  // disables Tailwind's global base/reset layer (preflight) — without both,
  // this plugin's CSS leaks out and overrides host app (care_fe) styling.
  // Every component exposed via manifest.tsx must wrap its root in
  // <div className="care-dvdms-container">.
  important: ".care-dvdms-container",
  corePlugins: {
    preflight: false,
  },
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
