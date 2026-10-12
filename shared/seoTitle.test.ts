import assert from "node:assert/strict";
import test from "node:test";
import { brandPageTitle, homepageTitle } from "./seoTitle.js";

test("brandPageTitle puts Skale Club first for bare and legacy suffix titles", () => {
  assert.equal(brandPageTitle("Mais Clientes para a Sua Barbearia"), "Skale Club | Mais Clientes para a Sua Barbearia");
  assert.equal(brandPageTitle("Mais Clientes para a Sua Barbearia | Skale Club"), "Skale Club | Mais Clientes para a Sua Barbearia");
  assert.equal(brandPageTitle("Skale Club | Mais Clientes para a Sua Barbearia"), "Skale Club | Mais Clientes para a Sua Barbearia");
});

test("brandPageTitle removes literal encoded whitespace instead of leaking it into the tab", () => {
  assert.equal(brandPageTitle("Skale Club |&#x20; Contact"), "Skale Club | Contact");
  assert.equal(brandPageTitle("Skale Club |&amp;#x20; Contact"), "Skale Club | Contact");
  assert.equal(brandPageTitle("Skale Club |&#32; Contact"), "Skale Club | Contact");
});

test("brandPageTitle does not duplicate the brand", () => {
  assert.equal(brandPageTitle("Skale Club"), "Skale Club");
  assert.equal(brandPageTitle("Contact", "Skale Club"), "Skale Club | Contact");
});

test("homepageTitle remains descriptive and brand-first", () => {
  assert.equal(
    homepageTitle({ companyName: "Skale Club", seoTitle: "Skale Club", heroTitle: "Data-Driven Growth" }),
    "Skale Club | Data-Driven Growth",
  );
  assert.equal(
    homepageTitle({ companyName: "Skale Club", seoTitle: "AI Automation | Skale Club" }),
    "Skale Club | AI Automation",
  );
});
