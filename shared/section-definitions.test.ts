import assert from "node:assert/strict";
import test from "node:test";
import {
  managedPageSectionSchema,
  migrateManagedSection,
  registeredSectionTypes,
  sectionDefinitionMetadata,
  sectionPropsSchemas,
  sectionStarterProps,
} from "./section-definitions.js";

test("every registered section has schema and metadata", () => {
  assert.deepEqual(
    [...registeredSectionTypes].sort(),
    Object.keys(sectionDefinitionMetadata).sort(),
  );
  assert.deepEqual(
    [...registeredSectionTypes].sort(),
    Object.keys(sectionPropsSchemas).sort(),
  );
});

test("every admin starter is immediately valid", () => {
  for (const type of registeredSectionTypes) {
    const result = sectionPropsSchemas[type].safeParse(sectionStarterProps[type]);
    assert.equal(result.success, true, `${type} starter props must validate`);
  }
});

test("unknown section types are rejected", () => {
  const result = managedPageSectionSchema.safeParse({ type: "notRegistered", props: {} });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(result.error.issues[0]?.path, ["type"]);
  }
});

test("invalid props retain their field path", () => {
  const result = managedPageSectionSchema.safeParse({
    type: "featureGrid",
    version: 1,
    props: { heading: "Example", items: [] },
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((issue) => issue.path.join(".") === "props.items"));
  }
});

test("unsupported persisted versions are rejected", () => {
  const result = managedPageSectionSchema.safeParse({ type: "reviews", version: 99, props: {} });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((issue) => issue.path.join(".") === "version"));
  }
});

test("missing version remains compatible with existing stored pages", () => {
  const result = managedPageSectionSchema.safeParse({ type: "reviews", props: {} });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.version, sectionDefinitionMetadata.reviews.version);
  }
});

test("migration normalization is idempotent for current definitions", () => {
  const once = migrateManagedSection({ type: "reviews", props: {} });
  const twice = migrateManagedSection(once);
  assert.deepEqual(once, { type: "reviews", version: 1, props: {} });
  assert.deepEqual(twice, once);
});

test("our services supports an ordered mix of existing products and services", () => {
  const result = sectionPropsSchemas.ourServices.safeParse({
    title: "For your barbershop",
    items: [
      { source: "product", slug: "scheduling-system" },
      { source: "service", title: "Paid Advertising" },
    ],
  });
  assert.equal(result.success, true);
});

test("industry hero is configurable without a page-specific component", () => {
  const result = sectionPropsSchemas.heroWebsites.safeParse({
    layout: "industry",
    eyebrow: "Built for Salons",
    headlineLines: [
      { text: "More time for your clients." },
      { text: "Less time on the phone.", accent: true },
    ],
    mediaItems: [
      {
        imageUrl: "/salons/hero.webp",
        imageAlt: "A stylist serving a client.",
        imageWidth: 1200,
        imageHeight: 900,
        focalPoint: "center",
      },
    ],
    mediaAspectRatio: "4:3",
    mediaRadius: "medium",
    carouselAutoplayMs: 7000,
  });

  assert.equal(result.success, true);
});

test("industry hero rejects media without a usable image URL", () => {
  const result = sectionPropsSchemas.heroWebsites.safeParse({
    layout: "industry",
    mediaItems: [{ imageAlt: "Missing image" }],
  });

  assert.equal(result.success, false);
});
