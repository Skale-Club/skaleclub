import test from "node:test";
import assert from "node:assert/strict";
import { routeParam } from "../routeParam.js";

test("named resource parameters remain scalar on Express 5", () => {
  assert.equal(routeParam({ params: { id: "42" } }, "id"), "42");
  assert.throws(() => routeParam({ params: {} }, "id"), { status: 400 });
  assert.throws(() => routeParam({ params: { id: ["first", "second"] } }, "id"), { status: 400 });
});
