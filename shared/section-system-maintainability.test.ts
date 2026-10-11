import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("documented canonical section-system paths exist", () => {
  const paths = [
    "client/src/styles/section-tokens.css",
    "client/src/components/editorial/SectionFrame.tsx",
    "shared/section-definitions.ts",
    "client/src/components/pages/sectionRegistry.ts",
    "docs/PUBLIC_SECTION_TEMPLATE_SYSTEM.md",
    ".planning/plans/public-section-template-system-v1.md",
  ];
  for (const path of paths) {
    assert.equal(existsSync(resolve(root, path)), true, `${path} must exist`);
  }
});

test("ordinary section roles are controlled by one token source", () => {
  const css = readFileSync(resolve(root, "client/src/styles/section-tokens.css"), "utf8");
  for (const role of ["editorial", "dense", "compact", "pill", "cta"]) {
    assert.match(css, new RegExp(`--section-space-${role}:`));
    assert.match(css, new RegExp(`\\.section-frame--${role}\\s*\\{[\\s\\S]*?var\\(--section-space-${role}\\)`));
  }
  assert.doesNotMatch(css, /\.section-y\b/);
});

test("hero and bridge roles do not inherit ordinary section padding", () => {
  const css = readFileSync(resolve(root, "client/src/styles/section-tokens.css"), "utf8");
  assert.match(css, /\.section-frame--bridge,[\s\S]*\.section-frame--hero\s*\{\s*padding-block:\s*0;/);
});

test("managed renderers provide the role declared by shared metadata", () => {
  const registry = readFileSync(resolve(root, "client/src/components/pages/sectionRegistry.ts"), "utf8");
  assert.match(registry, /SectionRoleProvider/);
  assert.match(registry, /role:\s*metadata\.role/);
});
