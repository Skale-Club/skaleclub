import assert from "node:assert/strict";
import test from "node:test";
import { brandFirstTitle, brandPageTitle, homepageTitle } from "./seoTitle.js";

test("brandPageTitle puts the page keyword first and the brand last", () => {
  assert.equal(brandPageTitle("Services"), "Services | Skale Club");
  assert.equal(brandPageTitle("Mais Clientes para a Sua Barbearia"), "Mais Clientes para a Sua Barbearia | Skale Club");
  assert.equal(brandPageTitle("Mais Clientes para a Sua Barbearia | Skale Club"), "Mais Clientes para a Sua Barbearia | Skale Club");
  assert.equal(brandPageTitle("Skale Club | Mais Clientes para a Sua Barbearia"), "Mais Clientes para a Sua Barbearia | Skale Club");
  assert.equal(brandPageTitle("Skale Club: Services"), "Services | Skale Club");
});

test("brandPageTitle removes literal encoded whitespace instead of leaking it into the tab", () => {
  assert.equal(brandPageTitle("Skale Club |&#x20; Contact"), "Contact | Skale Club");
  assert.equal(brandPageTitle("Skale Club |&amp;#x20; Contact"), "Contact | Skale Club");
  assert.equal(brandPageTitle("Skale Club |&#32; Contact"), "Contact | Skale Club");
});

test("brandPageTitle does not duplicate the brand", () => {
  assert.equal(brandPageTitle("Skale Club"), "Skale Club");
  assert.equal(brandPageTitle("Contact", "Skale Club"), "Contact | Skale Club");
});

test("brandFirstTitle keeps the brand first, for the homepage only", () => {
  assert.equal(brandFirstTitle("Data-Driven Growth"), "Skale Club | Data-Driven Growth");
  assert.equal(brandFirstTitle("Data-Driven Growth | Skale Club"), "Skale Club | Data-Driven Growth");
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
