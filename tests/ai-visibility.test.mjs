// The AI-visibility fix, stated as the experience it must create.
//
// Round 1 of the AI Visibility Check (24 Sep 2026) found that ChatGPT, Gemini,
// Claude and Perplexity could not say what Bureau Intake costs, and that none
// of 83 answers cited bureauintake.nl. So:
//   (a) someone (or an assistant) asking "Wat kost Bureau Intake?" finds a page
//       that answers it in plain Q&As, with structured data saying the same;
//   (b) someone asking what online marketing for a practice costs finds an
//       honest article with sourced prices, Bureau Intake's own price included;
//   (c) both pages are in the sitemap and reachable by links;
//   (d) the IndexNow key file is live, so Bing and others can be told to crawl.
//
// Every price and term is read from the site's own source (the homepage price
// card), never typed twice here.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  DIST, ROOT, SITE, source, page, pageExists, allPages, visibleText, normalize,
  jsonLdNodes, textsByClass, title, metaDescription, canonical, hasLinkTo,
  euroAmounts, pricingCard,
} from './built-site.mjs';

const PRICE_PAGE = '/tarief/';
const ARTICLE_SLUG = 'wat-kost-online-marketing-voor-een-fysiotherapiepraktijk';
const ARTICLE = `/blog/${ARTICLE_SLUG}/`;
const ARTICLE_TITLE = 'Wat kost online marketing voor een fysiotherapiepraktijk?';
const ARTICLE_SOURCE = `src/content/blog/${ARTICLE_SLUG}.md`;
const SHY = String.fromCharCode(0xad);
const DUTCH_DATE = /\b\d{1,2} (januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december) 20\d\d\b/;

const card = pricingCard();
const lower = (s) => s.toLowerCase();

// The trial month is stated in the homepage meta description (src/pages/index.astro).
// A new page may only repeat it while that source still says it.
const homepageSaysTrial = /gratis proefmaand/i.test(source('src/pages/index.astro'));

function visibleQandAs(html) {
  const questions = textsByClass(html, 'faq-question');
  const answers = textsByClass(html, 'faq-body');
  assert.equal(questions.length, answers.length, 'every visible question needs one visible answer');
  return questions.map((q, i) => ({ q, a: answers[i] }));
}

describe('(a) the price page answers "Wat kost Bureau Intake?"', () => {
  test('a price page exists at /tarief/', () => {
    assert.ok(pageExists(PRICE_PAGE), `expected a built page at ${PRICE_PAGE}`);
  });

  test('it answers "Wat kost Bureau Intake?" with the price and every term from the homepage price card', () => {
    const qa = visibleQandAs(page(PRICE_PAGE));
    const hit = qa.find(({ q }) => q === 'Wat kost Bureau Intake?');
    assert.ok(hit, `no visible question "Wat kost Bureau Intake?" (found: ${qa.map((x) => x.q).join(' | ')})`);
    assert.ok(hit.a.includes(`${card.priceText} per ${card.unit}`), `answer must state "${card.priceText} per ${card.unit}": ${hit.a}`);
    for (const term of card.terms) {
      assert.ok(lower(hit.a).includes(lower(term)), `answer must state "${term}": ${hit.a}`);
    }
  });

  test('it says what Bureau Intake is, so the name is not read as an intake desk', () => {
    const qa = visibleQandAs(page(PRICE_PAGE));
    const hit = qa.find(({ q }) => q === 'Wat is Bureau Intake?');
    assert.ok(hit, 'no visible question "Wat is Bureau Intake?"');
    assert.match(hit.a, /marketingbureau/);
    assert.match(hit.a, /fysiotherapiepraktijken/);
  });

  test('it states the free trial month only while the homepage source still promises it', () => {
    const text = visibleText(page(PRICE_PAGE));
    assert.ok(homepageSaysTrial, 'src/pages/index.astro no longer mentions "gratis proefmaand"; update the price page to match');
    assert.match(text, /gratis proefmaand/i);
  });

  test('it lists everything the price card includes, word for word', () => {
    const text = visibleText(page(PRICE_PAGE));
    for (const item of card.includes) assert.ok(text.includes(item), `missing included item: "${item}"`);
  });

  test('its FAQPage structured data says exactly what the page shows', () => {
    const html = page(PRICE_PAGE);
    const faq = jsonLdNodes(html).find((n) => n['@type'] === 'FAQPage');
    assert.ok(faq, 'no FAQPage node in the JSON-LD');
    assert.equal(faq['@id'], `${SITE}${PRICE_PAGE}#faq`);
    const fromSchema = faq.mainEntity.map((e) => {
      assert.equal(e['@type'], 'Question');
      assert.equal(e.acceptedAnswer['@type'], 'Answer');
      return { q: normalize(e.name), a: normalize(e.acceptedAnswer.text) };
    });
    assert.deepEqual(fromSchema, visibleQandAs(html));
  });

  test('every price on the page is the price-card price, and nothing unsourced is claimed', () => {
    const html = page(PRICE_PAGE);
    const text = `${title(html)} ${metaDescription(html)} ${visibleText(html)}`;
    const amounts = euroAmounts(text);
    assert.ok(amounts.length > 0, 'the page states no price at all');
    for (const a of amounts) assert.equal(a, card.amount, `unexpected price €${a} on the price page`);
    // No founder-confirmed source exists for these, so they must not appear.
    for (const banned of [/break-even/i, /garantie/i, /\bbtw\b/i, /30 dagen/i, /%/]) {
      assert.doesNotMatch(text, banned);
    }
  });

  test('title, description and canonical follow the house SEO rules', () => {
    const html = page(PRICE_PAGE);
    assert.ok(title(html).length <= 60, `title too long (${title(html).length}): ${title(html)}`);
    assert.ok(metaDescription(html).length <= 155, `description too long (${metaDescription(html).length})`);
    assert.equal(canonical(html), `${SITE}${PRICE_PAGE}`);
  });
});

describe('(b) the article on what online marketing costs', () => {
  const articleHtml = () => page(ARTICLE);
  const body = () => {
    const html = articleHtml();
    const start = html.indexOf('class="prose-bi"');
    const end = html.indexOf('</article>', start);
    assert.ok(start > 0 && end > start, 'no article body (.prose-bi) found');
    return html.slice(start, end);
  };
  const split = () => {
    const b = body();
    const at = b.search(/<h2 id="bronnen"/);
    assert.ok(at > 0, 'the article needs a "## Bronnen" section');
    return { prose: b.slice(0, at), sources: b.slice(at) };
  };

  test('the article exists with the agreed title as its only H1', () => {
    assert.ok(pageExists(ARTICLE), `expected a built page at ${ARTICLE}`);
    const h1s = [...articleHtml().matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => visibleText(m[1]));
    assert.deepEqual(h1s, [ARTICLE_TITLE]);
  });

  test('it states Bureau Intake\'s price and terms exactly as the price card does, and links to the price page', () => {
    const { prose } = split();
    const text = visibleText(prose);
    assert.ok(text.includes(`${card.priceText} per ${card.unit}`), `article must state "${card.priceText} per ${card.unit}"`);
    for (const term of card.terms) assert.ok(lower(text).includes(lower(term)), `article must state "${term}"`);
    assert.ok(homepageSaysTrial);
    assert.match(text, /gratis proefmaand/i);
    assert.ok(hasLinkTo(prose, PRICE_PAGE), 'article must link to /tarief/');
  });

  test('every other price, term length and percentage it states is listed under Bronnen with a link and a fetch date', () => {
    const { prose, sources } = split();
    const items = [...sources.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
    assert.ok(items.length > 0, 'Bronnen lists no sources');
    for (const li of items) {
      assert.match(li, /<a href="https:\/\/[^"]+"/, `source without a link: ${visibleText(li)}`);
      assert.match(visibleText(li), DUTCH_DATE, `source without a fetch date: ${visibleText(li)}`);
    }
    const itemTexts = items.map(visibleText);
    const text = visibleText(prose);

    const prices = euroAmounts(text).filter((a) => a !== card.amount);
    assert.ok(prices.length > 0, 'the article states no published prices at all');
    for (const a of prices) {
      assert.ok(itemTexts.some((t) => euroAmounts(t).includes(a)), `€${a} is stated but not in any source under Bronnen`);
    }
    for (const [, n] of text.matchAll(/(\d+) maanden/g)) {
      assert.ok(itemTexts.some((t) => t.includes(`${n} maanden`)), `"${n} maanden" is stated but not in any source`);
    }
    for (const [pct] of text.matchAll(/\d+(?:,\d+)?\s?%/g)) {
      assert.ok(itemTexts.some((t) => t.includes(pct)), `"${pct}" is stated but not in any source`);
    }
    // Sources the research refused (bot-walled, 403, robots-disallowed, dead).
    for (const refused of ['trustoo.nl', 'clickables.nl', 'physicalleads.nl/website-pakketten', 'fysiosites.nl']) {
      assert.ok(!sources.includes(refused), `refused source used: ${refused}`);
    }
  });

  test('its BlogPosting structured data carries the same headline', () => {
    const post = jsonLdNodes(articleHtml()).find((n) => n['@type'] === 'BlogPosting');
    assert.ok(post, 'no BlogPosting node');
    assert.equal(post.headline, ARTICLE_TITLE);
    assert.equal(post.url, `${SITE}${ARTICLE}`);
  });

  test('house style: no em dashes, no guarantees, no SEO jargon, description within 155 characters', () => {
    assert.ok(existsSync(join(ROOT, ARTICLE_SOURCE)), `missing ${ARTICLE_SOURCE}`);
    const md = source(ARTICLE_SOURCE);
    assert.doesNotMatch(md, /—/, 'em dash in the article');
    assert.doesNotMatch(md, /garantie/i);
    for (const jargon of ['rankings', 'backlinks', 'crawlbudget', 'SERP', 'traffic']) {
      assert.ok(!md.toLowerCase().includes(jargon.toLowerCase()), `jargon: ${jargon}`);
    }
    assert.ok(metaDescription(articleHtml()).length <= 155, 'description too long');
  });

  test('the long compound in the H1 breaks at its seam on phones and never auto-hyphenates on desktop', () => {
    const html = articleHtml();
    const h1 = html.match(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/);
    assert.ok(h1[2].includes(`fysiotherapie${SHY}praktijk`), 'H1 needs a soft hyphen at fysiotherapie|praktijk');
    assert.doesNotMatch(h1[1], /hyphens:\s*auto/, 'H1 must not set hyphens:auto inline (desktop); global.css does it for phones only');
    // The soft hyphen is display-only: never in the title, schema or feed.
    assert.ok(!title(html).includes(SHY));
    assert.ok(!JSON.stringify(jsonLdNodes(html)).includes(SHY));
  });
});

describe('(c) both pages can be found', () => {
  test('both new URLs are in the built sitemap.xml', () => {
    const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
    for (const p of [PRICE_PAGE, ARTICLE]) {
      assert.ok(sitemap.includes(`<loc>${SITE}${p}</loc>`), `${p} missing from sitemap.xml`);
    }
  });

  test('the price page is linked from every page and from the homepage price section', () => {
    for (const [path, html] of allPages()) {
      assert.ok(hasLinkTo(html, PRICE_PAGE), `${path} has no link to ${PRICE_PAGE}`);
    }
    const home = page('/');
    const pricing = home.match(/<section[^>]*aria-labelledby="pricing-heading"[\s\S]*?<\/section>/);
    assert.ok(pricing, 'no pricing section on the homepage');
    assert.ok(hasLinkTo(pricing[0], PRICE_PAGE), 'the homepage price section does not link to the price page');
  });

  test('the article is linked from the blog index and from the price page', () => {
    assert.ok(hasLinkTo(page('/blog/'), ARTICLE), '/blog/ does not link to the article');
    assert.ok(hasLinkTo(page(PRICE_PAGE), ARTICLE), '/tarief/ does not link to the article');
  });
});

describe('(d) IndexNow key file', () => {
  const keyFiles = () =>
    readdirSync(DIST)
      .filter((f) => f.endsWith('.txt'))
      .filter((f) => readFileSync(join(DIST, f), 'utf8') === f.slice(0, -4));

  test('exactly one key file is published at the site root, holding only its key', () => {
    assert.equal(keyFiles().length, 1, `expected one <key>.txt whose content is exactly its key, found ${keyFiles().length}`);
  });

  test('the key meets IndexNow\'s format rules (8 to 128 characters; hexadecimal satisfies both readings of the docs)', () => {
    const [file] = keyFiles();
    assert.ok(file, 'no key file');
    const key = file.slice(0, -4);
    assert.match(key, /^[A-Za-z0-9-]{8,128}$/);
    assert.match(key, /^[0-9a-f]+$/);
  });

  test('the key file ships from public/ and robots.txt does not block it', () => {
    const [file] = keyFiles();
    assert.ok(file, 'no key file');
    assert.equal(readFileSync(join(ROOT, 'public', file), 'utf8'), file.slice(0, -4));
    const robots = readFileSync(join(DIST, 'robots.txt'), 'utf8');
    assert.doesNotMatch(robots, /^Disallow:\s*\/\S*/m);
  });
});
