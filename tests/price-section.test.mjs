// The homepage price section, stated as the experience it must create.
//
// A physio who has just had the cold call types bureauintake.nl and reads the
// price section. Two things must be true there:
//   (1) The break-even line gives the same number of patients as the FAQ under
//       it (and the cold-call script): three. It said two, and two new patients
//       (2 x EUR 270 = EUR 540) do not cover EUR 590 a month.
//   (2) The price card states the free trial month, which the owner, Iwan
//       Stepanova, confirmed on 25 Sep 2026 is still offered, in the same words
//       /tarief/ uses, so no two pages describe the offer differently.
//
// Every number is read from the built site (the FAQ's own "€270 ... (6
// behandelingen × €45)" and the price card's €590), never typed again here.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SITE, page, allPages, visibleText, metaDescription, jsonLdNodes, pricingCard } from './built-site.mjs';

const card = pricingCard();
const TRIAL = 'gratis proefmaand';
const COUNT_WORDS = { een: 1, 'één': 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10 };
const COUNT_CLAIM = new RegExp(
  `(?<![\\p{L}\\d])(\\d+|${Object.keys(COUNT_WORDS).join('|')})\\s+extra\\s+patiënt(?:en)?\\s+per\\s+maand`,
  'giu',
);

/** Everything a reader, a crawler or an AI assistant can read on a page. */
function readable(html) {
  return [visibleText(html), metaDescription(html) ?? '', JSON.stringify(jsonLdNodes(html))].join(' ');
}

/** Every "<n> extra patiënten per maand" in a text, with n as a number. */
function patientCounts(text) {
  return [...text.matchAll(COUNT_CLAIM)].map((m) => {
    const word = m[1].toLowerCase();
    return { phrase: m[0], n: /^\d+$/.test(word) ? Number(word) : COUNT_WORDS[word] };
  });
}

function homepagePriceSection() {
  const m = page('/').match(/<section[^>]*aria-labelledby="pricing-heading"[\s\S]*?<\/section>/);
  assert.ok(m, 'no pricing section on the homepage');
  return m[0];
}

/** What one new patient is worth, as the homepage FAQ states and derives it. */
function patientValue() {
  const m = visibleText(page('/')).match(/€(\d+) aan omzet op \((\d+) behandelingen × €(\d+)\)/);
  assert.ok(m, 'the homepage no longer states what one new patient is worth ("€… aan omzet op (… behandelingen × €…)")');
  const [value, visits, rate] = m.slice(1).map(Number);
  assert.equal(value, visits * rate, `the FAQ says €${value}, but ${visits} × €${rate} = €${visits * rate}`);
  return value;
}

function homepageOffer() {
  const service = jsonLdNodes(page('/')).find((n) => n['@id'] === `${SITE}/#local-seo-service`);
  assert.ok(service?.offers, 'no Service with an Offer in the homepage JSON-LD');
  return service.offers;
}

describe('(1) break-even: the site gives one patient count, and it is the right one', () => {
  test('no page claims break-even at two patients: every "extra patiënten per maand" is the smallest count whose value covers the price', () => {
    const value = patientValue();
    const breakEven = Math.ceil(card.amount / value);
    // The proposition itself: one patient fewer does not cover the price, this many does.
    assert.ok((breakEven - 1) * value < card.amount && breakEven * value >= card.amount);

    assert.ok(
      patientCounts(visibleText(homepagePriceSection())).length > 0,
      'the homepage price section states no patient count at all, so this test would prove nothing',
    );
    for (const [path, html] of allPages()) {
      for (const { phrase, n } of patientCounts(readable(html))) {
        assert.equal(
          n,
          breakEven,
          `${path} says "${phrase}": ${n} × €${value} = €${n * value} against €${card.amount} a month; the count that covers it is ${breakEven}`,
        );
      }
    }
  });
});

describe('(2) the free trial month is on the price card, in the words /tarief/ uses', () => {
  test('the price card lists "gratis proefmaand" among its terms, as /tarief/ states it', () => {
    assert.ok(
      visibleText(page('/tarief/')).toLowerCase().includes(TRIAL),
      `/tarief/ no longer says "${TRIAL}"; settle the wording there first`,
    );
    assert.ok(
      card.terms.some((t) => t.toLowerCase() === TRIAL),
      `the price card terms ("${card.terms.join(' · ')}") do not include "${TRIAL}"`,
    );
    assert.ok(
      visibleText(homepagePriceSection()).toLowerCase().includes(TRIAL),
      'the homepage price section does not show the free trial month',
    );
  });

  // At 390px the terms line wrapped as "... Geen opstartkosten · Gratis" / "proefmaand":
  // the trial was split across lines (and "Geen" / "jaarcontract" before it).
  // Measured in headless Chrome, 25 Sep 2026. A line may only break after a "·".
  test('on a phone the card terms wrap between terms, never inside one', () => {
    const m = homepagePriceSection().match(/\/maand\s*<\/span>\s*<\/div>\s*<p[^>]*>([\s\S]*?)<\/p>/);
    assert.ok(m, 'no terms line under the price in the built homepage');
    const pieces = m[1].trim().split(/[ \t\r\n]+/);
    assert.ok(pieces.length >= 4, `expected one piece per term, got: ${JSON.stringify(pieces)}`);
    for (const piece of pieces.slice(0, -1)) {
      assert.ok(piece.endsWith('·'), `the line can break after "${piece}", inside a term`);
    }
  });

  test('no page names the trial any other way', () => {
    for (const [path, html] of allPages()) {
      const text = readable(html);
      for (const m of text.matchAll(/(\S+)\s+proefmaand/gi)) {
        assert.equal(m[1].toLowerCase(), 'gratis', `${path} says "${m[0]}", not "${TRIAL}"`);
      }
      assert.doesNotMatch(text, /\b(?:\d+|dertig)\s+dagen\s+gratis\b|\bmaand\s+gratis\b|\bgratis\s+proefperiode\b/i, `${path} names the trial differently`);
    }
  });

  test('the homepage Offer description carries every price-card term, the trial included, and no second price', () => {
    const offer = homepageOffer();
    const description = offer.description.toLowerCase();
    for (const term of card.terms) {
      assert.ok(description.includes(term.toLowerCase()), `Offer.description lacks "${term}": ${offer.description}`);
    }
    assert.ok(description.includes(TRIAL), `Offer.description lacks "${TRIAL}": ${offer.description}`);
    // The trial is stated in words, not as a €0 price component: every price in
    // the Offer is the price-card price.
    assert.equal(Number(offer.price), card.amount);
    for (const spec of [].concat(offer.priceSpecification ?? [])) assert.equal(Number(spec.price), card.amount);
  });
});
