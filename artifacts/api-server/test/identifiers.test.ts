import test from "node:test";
import assert from "node:assert/strict";
import { normalizeIdentifierSearch } from "../src/utils/identifiers";

test("normalizeIdentifierSearch trims text and builds an ilike pattern", () => {
  assert.deepEqual(normalizeIdentifierSearch("  PO-123  "), {
    text: "PO-123",
    pattern: "%PO-123%",
    numericId: null,
  });
});

test("normalizeIdentifierSearch exposes numeric ids for exact id matching", () => {
  assert.deepEqual(normalizeIdentifierSearch("123"), {
    text: "123",
    pattern: "%123%",
    numericId: 123,
  });
});

test("normalizeIdentifierSearch ignores empty input", () => {
  assert.equal(normalizeIdentifierSearch("   "), null);
  assert.equal(normalizeIdentifierSearch(undefined), null);
});
