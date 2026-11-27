#!/usr/bin/env bash
# Checks whether the latest core (a checkout of its `develop` branch in $CORE_DIR) still
# fits this plugin. Run from the plugin root, on the plugin's default branch. Exit code 0: no impact. 1: impacted.
#
# This plugin does not import core source, so the checks compare contracts:
#   1. shared modules  2. manifest (components, extensions, overridden components)
set -euo pipefail

: "${CORE_DIR:?CORE_DIR must point to a core checkout}"

node --input-type=module - <<'JS'
import fs from "node:fs";
import path from "node:path";

process.on("uncaughtException", (e) => {
  console.log(`::error::${e.message}`);
  process.exit(1);
});

const core = process.env.CORE_DIR;
const read = (p) => fs.readFileSync(p, "utf8");
const errors = [];
const fail = (message) => errors.push(message);

const walk = (dir, files = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, files);
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
  return files;
};
const coreSrc = walk(path.join(core, "src")).map(read).join("\n");
const strings = (text) => [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

// 1. Shared modules: each one must be shared by core too, with the same major version.
const sharedOf = (file) => {
  const m = read(file).replace(/\/\/.*$/gm, "").match(/shared:\s*\[([^\]]*)\]/);
  return m ? strings(m[1]) : [];
};
const versionsOf = (file) => {
  const p = JSON.parse(read(file));
  return { ...p.devDependencies, ...p.peerDependencies, ...p.dependencies };
};
const major = (range) => range?.match(/\d+/)?.[0];

const coreConfig = ["vite.config.mts", "vite.config.ts"]
  .map((f) => path.join(core, f))
  .find(fs.existsSync);
const coreShared = coreConfig ? sharedOf(coreConfig) : [];
if (!coreShared.length) fail("Could not read the shared modules of core.");
const pluginVersions = versionsOf("package.json");
const coreVersions = versionsOf(path.join(core, "package.json"));
const pluginConfig = ["vite.config.ts", "vite.config.mjs", "vite.config.mts", "vite.config.js"].find(fs.existsSync);
if (!pluginConfig) fail("Could not find the Vite config of the plugin.");
const pluginShared = pluginConfig ? sharedOf(pluginConfig) : [];
if (!pluginShared.length) fail("Could not read the shared modules of the plugin.");
for (const name of pluginShared) {
  if (!coreShared.includes(name)) {
    fail(`Shared module "${name}" is not shared by core.`);
  } else if (!major(pluginVersions[name]) || !major(coreVersions[name])) {
    fail(
      `Shared module "${name}": cannot read the version (plugin ${pluginVersions[name]}, core ${coreVersions[name]}).`,
    );
  } else if (major(pluginVersions[name]) !== major(coreVersions[name])) {
    fail(
      `Shared module "${name}": plugin ${pluginVersions[name]}, core ${coreVersions[name]} (different major version).`,
    );
  }
}

// 2. Manifest: the components and extensions it uses must still exist in core.
const types = read(path.join(core, "src/pluginTypes.ts"));
const typeBody = (name) =>
  types.match(new RegExp(`type ${name} =\\s*\\{([\\s\\S]*?)\\n\\};`))?.[1] ?? "";
const coreComponents = [
  ...typeBody("SupportedPluginComponents").matchAll(/^ {2}(\w+)\??:/gm),
].map((m) => m[1]);
const coreExtensions = strings(
  types.match(/type SupportedPluginExtensions =\s*([^;]+);/)?.[1] ?? "",
);
if (!coreComponents.length) fail("Could not read the plugin components of core.");

const manifest = read("src/manifest.tsx");
const manifestComponents = [
  ...(manifest.match(/^ {2}components: \{([\s\S]*?)^ {2}\},/m)?.[1] ?? "").matchAll(
    /^ {4}(\w+):/gm,
  ),
].map((m) => m[1]);
if (!manifestComponents.length) fail("Could not read the components of the manifest.");
for (const name of manifestComponents) {
  if (!coreComponents.includes(name)) fail(`Component "${name}" is no longer supported by core.`);
}
for (const name of strings(manifest.match(/extends:\s*\[([^\]]*)\]/)?.[1] ?? "")) {
  if (!coreExtensions.includes(name)) fail(`Extension "${name}" is no longer supported by core.`);
}
for (const [, name] of manifest.matchAll(/component:\s*"(\w+)"/g)) {
  if (!new RegExp(`\\b(function|const|class)\\s+${name}\\b`).test(coreSrc)) {
    fail(`Overridden component "${name}" no longer exists in core.`);
  }
}

if (errors.length) {
  for (const e of errors) console.log(`::error::${e}`);
  process.exit(1);
}
console.log("No impact found: shared modules and manifest match core.");
JS
