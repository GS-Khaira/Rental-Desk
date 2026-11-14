// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { explainMailError, maskEmail } from "../src/lib/server/mailText.ts";

test("a rejected Gmail login is explained as a password problem", () => {
  const gmail = { code: "EAUTH", responseCode: 535, command: "AUTH PLAIN", response: "535-5.7.8 Username and Password not accepted. BadCredentials" };
  assert.match(explainMailError(gmail), /Gmail rejected the login/);
  assert.match(explainMailError({ code: "ETIMEDOUT", command: "AUTH PLAIN", message: "Timeout" }), /Gmail rejected the login/);
});

test("connection and limit problems get their own explanations", () => {
  assert.match(explainMailError({ code: "ESOCKET", command: "CONN", message: "connect ECONNREFUSED" }, "smtp.gmail.com:465"), /Couldn't connect to the mail server \(smtp\.gmail\.com:465\)/);
  assert.match(explainMailError({ responseCode: 550, response: "550 5.4.5 Daily user sending limit exceeded" }), /daily sending limit/);
  assert.match(explainMailError(new Error("something odd")), /^Sending failed: something odd/);
});

test("email addresses are masked", () => {
  assert.equal(maskEmail("kueppers.rentaldesk@gmail.com"), "ku•••@gmail.com");
});
