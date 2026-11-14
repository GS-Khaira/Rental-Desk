// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequestEmail } from "../src/lib/server/requestEmail.ts";

const base = { subject: "Kitchen tap is dripping", category: "Maintenance", tenantName: "Jordan Lee", place: "18 Water St · Unit A", link: "https://app.example/#requests", recipientName: "Mia Arsenault" };

test("new request email names the tenant, place and message", () => {
  const e = buildRequestEmail({ ...base, event: { kind: "new_request" }, message: "Dripping since Sunday." });
  assert.equal(e.subject, "New request: Kitchen tap is dripping (18 Water St · Unit A)");
  assert.ok(e.text.startsWith("Hi Mia,"));
  assert.ok(e.text.includes("Jordan Lee sent a new maintenance request about 18 Water St · Unit A."));
  assert.ok(e.text.includes('"Dripping since Sunday."'));
  assert.ok(e.html.includes("https://app.example/#requests"));
});

test("replies and status changes have their own subjects", () => {
  assert.equal(buildRequestEmail({ ...base, event: { kind: "tenant_reply" }, message: "x" }).subject, "Jordan Lee replied: Kitchen tap is dripping");
  assert.equal(buildRequestEmail({ ...base, event: { kind: "staff_reply" }, message: "x" }).subject, "Reply to your request: Kitchen tap is dripping");
  assert.equal(buildRequestEmail({ ...base, event: { kind: "status", status: "Resolved" }, message: null }).subject, "Your request is resolved: Kitchen tap is dripping");
  assert.equal(buildRequestEmail({ ...base, event: { kind: "status", status: "In progress" }, message: null }).subject, "Your request is in progress: Kitchen tap is dripping");
});

test("tenant text can't inject HTML, and long messages are shortened", () => {
  const e = buildRequestEmail({ ...base, event: { kind: "tenant_reply" }, message: '<script>alert(1)</script>' + "a".repeat(2000) });
  assert.ok(!e.html.includes("<script>"));
  assert.ok(e.html.includes("&lt;script&gt;"));
  assert.ok(e.text.length < 1500);
  assert.ok(e.text.includes("…"));
});
