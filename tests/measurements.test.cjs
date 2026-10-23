const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createShellDescriptionSchema } = require("../dist/validation/shell-description.js");
const { unitSchema } = require("../dist/validation/unit.js");

test("shell measurements accept descriptive text and reject numeric-only weight input", () => {
  assert.equal(createShellDescriptionSchema.safeParse({ shell_size: "5–7 cm", shell_weight: "approximately 20 g" }).success, true);
  assert.equal(createShellDescriptionSchema.safeParse({ shell_size: "2 × 4", shell_weight: "20 ounces" }).success, true);
  assert.equal(createShellDescriptionSchema.safeParse({ shell_weight: 20 }).success, false);
  assert.equal(createShellDescriptionSchema.safeParse({ shell_size: "x".repeat(121) }).success, false);
});

test("measurement units use the canonical size and weight categories", () => {
  assert.equal(unitSchema.safeParse({ unit_name: "cm", measurement_for: "size" }).success, true);
  assert.equal(unitSchema.safeParse({ unit_name: "g", measurement_for: "weight" }).success, true);
  assert.equal(unitSchema.safeParse({ unit_name: "cm", measurement_for: "Size" }).success, false);
  assert.equal(unitSchema.safeParse({ unit_name: "", measurement_for: "weight" }).success, false);
});
