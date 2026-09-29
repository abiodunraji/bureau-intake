// The address change, stated as the experience it must create.
//
// On 29 Sep 2026 the owner, Iwan Stepanova, wrote (WhatsApp, 08:17): the address on
// bureauintake.nl is outdated. Madeliefstraat 13, 1817 CG Alkmaar becomes
// Loodglans 6, 1703 CL Heerhugowaard, "both in the footer and in the schema
// (Organization > address)", and "gevestigd in Alkmaar" becomes "gevestigd in
// Heerhugowaard". So:
//   (a) a person reading any page's footer sees the new address;
//   (b) a crawler or an AI assistant reading the Organization schema sees the same address;
//   (c) no page anywhere still gives the old address, or says Bureau Intake is based in Alkmaar;
//   (d) the place is said the same way everywhere (footer, schema, contact page, price FAQ),
//       because assistants and Google compare them, and a mismatch is what this work exists to remove.
//
// Blog posts may still say "fysiotherapeut Alkmaar": that is a search a patient types, not
// where Bureau Intake is based, so it is not an address claim.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { page, allPages, visibleText, jsonLdNodes } from './built-site.mjs';

const STREET = 'Loodglans 6';
const POSTAL = '1703 CL';
const CITY = 'Heerhugowaard';

const pages = allPages();

describe('the new address is what every visitor and crawler is told', () => {
  test('every page footer shows the new address', () => {
    assert.ok(pages.length > 5, 'the built site should have pages');
    for (const [path, html] of pages) {
      const text = visibleText(html);
      assert.ok(text.includes(STREET), `${path}: footer lacks "${STREET}"`);
      assert.ok(text.includes(`${POSTAL} ${CITY}`), `${path}: footer lacks "${POSTAL} ${CITY}"`);
    }
  });

  test('the Organization schema carries the new address on every page', () => {
    for (const [path, html] of pages) {
      const org = jsonLdNodes(html).find((n) => n['@type'] === 'Organization');
      assert.ok(org, `${path}: no Organization schema`);
      assert.deepEqual(
        { s: org.address.streetAddress, p: org.address.postalCode, l: org.address.addressLocality, c: org.address.addressCountry },
        { s: STREET, p: POSTAL, l: CITY, c: 'NL' },
        `${path}: Organization > address`,
      );
    }
  });

  test('the contact page names the same place', () => {
    const text = visibleText(page('/contact/'));
    assert.ok(text.includes(`${CITY}, Nederland`), 'contact page location');
  });

  test('the price FAQ and its FAQPage schema say Bureau Intake is based in Heerhugowaard', () => {
    const html = page('/tarief/');
    assert.ok(visibleText(html).includes(`gevestigd in ${CITY}`), 'visible FAQ answer');
    const faq = jsonLdNodes(html).find((n) => n['@type'] === 'FAQPage');
    assert.ok(faq, 'FAQPage schema present');
    assert.ok(JSON.stringify(faq).includes(`gevestigd in ${CITY}`), 'FAQPage schema answer');
  });
});

describe('nothing still says the old address, or that Bureau Intake is based in Alkmaar', () => {
  const OLD = [/Madeliefstraat/i, /1817\s?CG/i, /gevestigd in Alkmaar/i, /Alkmaar, Nederland/i];
  test('no page contains the old street, postcode or "based in Alkmaar" phrasing', () => {
    for (const [path, html] of pages) {
      for (const re of OLD) assert.doesNotMatch(html, re, `${path} still matches ${re}`);
    }
  });

  test('no Organization schema anywhere still lists Alkmaar', () => {
    for (const [path, html] of pages) {
      for (const n of jsonLdNodes(html).filter((x) => x['@type'] === 'Organization')) {
        assert.doesNotMatch(JSON.stringify(n), /Alkmaar/, `${path}: Organization schema still mentions Alkmaar`);
      }
    }
  });
});
