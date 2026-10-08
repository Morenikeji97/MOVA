import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DISPLAY_CURRENCIES,
  cardCurrencies,
  detailCurrencies,
  parseDisplayCurrency,
  selectedDisplayCurrency,
} from "./display-currency.ts";

test("the switcher offers USD, NGN, GHS and CFA", () => {
  assert.deepEqual(DISPLAY_CURRENCIES.map((c) => c.label), ["USD", "NGN", "GHS", "CFA"]);
});

test("only a known code from the cookie counts", () => {
  for (const c of ["USD", "NGN", "GHS", "XOF"]) assert.equal(parseDisplayCurrency(c), c);
  for (const v of [undefined, "", "CFA", "usd", "EUR", "NGN;"]) assert.equal(parseDisplayCurrency(v), null, String(v));
});

test("with no choice, pages show what they did before the switcher", () => {
  assert.equal(selectedDisplayCurrency(null), "NGN");
  assert.deepEqual(cardCurrencies(null), ["NGN"]);
  assert.deepEqual(detailCurrencies(null, ["GHS", "NGN", "XOF"]), ["GHS", "NGN", "XOF"]);
});

test("USD shows dollars alone", () => {
  assert.deepEqual(cardCurrencies("USD"), []);
  assert.deepEqual(detailCurrencies("USD", ["NGN", "GHS", "XOF"]), []);
});

test("a chosen currency is the card's local price and leads the listing's", () => {
  assert.deepEqual(cardCurrencies("XOF"), ["XOF"]);
  assert.deepEqual(detailCurrencies("XOF", ["NGN", "GHS", "XOF"]), ["XOF", "NGN", "GHS"]);
});

test("the switcher is display only: nothing that charges or stores money reads it", () => {
  for (const f of ["app/browse/[id]/actions.ts", "lib/fx.ts", "lib/fees.ts"]) {
    let src = "";
    try {
      src = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    assert.doesNotMatch(src, /display-currency/, f);
  }
});
