#!/usr/bin/env node
// Builds cloudflare/index.html — a matrix of every Cloudflare product.
//
//   node tools/cloudflare.mjs            use the cache in .cache/ where it exists
//   node tools/cloudflare.mjs --refresh  fetch everything again
//   --warnings=<file>                    also write the to-look-at list there, as Markdown
//
// If any fetch fails, it stops before writing anything: a blocked or half-fetched run must never
// replace a good page. The scheduled GitHub Action (.github/workflows/refresh.yml) relies on that.
//
// What is parsed, and from where:
//   - developers.cloudflare.com/llms.txt   every product, its category, docs link, one-line description
//   - <product>/llms.txt                   the product's Pricing page, when it has one
//   - www.cloudflare.com/sitemap.xml       every /products/<slug> marketing page
//   - www.cloudflare.com/products/<slug>   the page title and meta description
//
// It writes the page twice: cloudflare/index.html for people, cloudflare.md for AI tools.
//
// What is written by hand, in data/cloudflare.json:
//   - which marketing page belongs to which docs product
//   - Alternatives (if we have to move) and Cost
//   - products that only have a marketing page, and entries that are not products at all
//
// Anything new on either site that data/cloudflare.json does not know about is reported at the end,
// so a re-run tells you what to curate next.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache');
const REFRESH = process.argv.includes('--refresh');
const WARNINGS = process.argv.find((a) => a.startsWith('--warnings='))?.slice('--warnings='.length);
let failures = 0;
const DOCS = 'https://developers.cloudflare.com';
const WWW = 'https://www.cloudflare.com';
const SITE = 'https://stack.oinam.com';
const UA = 'Mozilla/5.0 (stack.oinam.com product matrix)';

// --- fetching, cached on disk -------------------------------------------------------------------

async function get(url) {
  const file = join(CACHE, createHash('sha1').update(url).digest('hex') + '.txt');
  if (!REFRESH) {
    try {
      return await readFile(file, 'utf8');
    } catch {}
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA } });
      if (res.status === 404) return '';
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      await writeFile(file, body);
      return body;
    } catch (err) {
      if (attempt === 3) {
        console.warn(`! ${url}: ${err.message}`);
        failures++;
        return '';
      }
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

// Run fn over items, a few at a time, keeping order.
async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: size }, worker));
  return out;
}

// --- parsing ------------------------------------------------------------------------------------

// "## Group" then "- [Name](https://developers.cloudflare.com/slug/llms.txt): Description"
function parseDirectory(text) {
  const products = [];
  let group = '';
  for (const line of text.split('\n')) {
    const heading = line.match(/^## (.+)/);
    if (heading) {
      group = heading[1].trim();
      continue;
    }
    const item = line.match(/^- \[(.+?)\]\((\S+?)\/llms\.txt\):\s*(.*)$/);
    if (item) {
      const docs = item[2] + '/';
      products.push({
        id: docs.slice(DOCS.length + 1, -1),
        name: item[1],
        group,
        docs,
        description: item[3].trim(),
      });
    }
  }
  return products;
}

// The product's Pricing page: a link whose path ends in /pricing/, the shallowest one.
function findPricing(text) {
  const links = [...text.matchAll(/\]\((https:\/\/developers\.cloudflare\.com\/\S+?\/)index\.md\)/g)]
    .map((m) => m[1])
    .filter((url) => /\/pricing\/$/.test(url))
    .sort((a, b) => a.split('/').length - b.split('/').length);
  return links[0] || '';
}

function parseSitemap(xml) {
  const slugs = new Set();
  for (const [, loc] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const m = loc.match(/^https:\/\/www\.cloudflare\.com\/products\/([a-z0-9-]+)\/?$/);
    if (m) slugs.add(m[1]);
  }
  return [...slugs].sort();
}

function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function parseMeta(html) {
  const title = html.match(/<title>([^<]*)/);
  const desc = html.match(/<meta name="description" content="([^"]*)"/);
  return {
    title: title ? decode(title[1]).replace(/\s*\|\s*Cloudflare\s*$/, '') : '',
    description: desc ? decode(desc[1]) : '',
  };
}

// --- rendering ----------------------------------------------------------------------------------

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Straight quotes and apostrophes to curly ones, for text that came from the web.
const smart = (s = '') =>
  s
    .replace(/(^|[\s(\[—–-])'/g, '$1‘')
    .replace(/'/g, '’')
    .replace(/(^|[\s(\[—–-])"/g, '$1“')
    .replace(/"/g, '”');

const text = (s) => esc(smart(s));

const link = (href, label, cls = '') =>
  `<a href="${esc(href)}"${cls ? ` class="${cls}"` : ''}>${label}</a>`;

function renderAlternatives(alts = []) {
  if (!alts.length) return '<span class="none">—</span>';
  return (
    '<ul class="alts">' +
    alts
      .map((a) => {
        const name = a.url ? link(a.url, text(a.name)) : text(a.name);
        return `<li>${name}${a.note ? ` <span class="note">${text(a.note)}</span>` : ''}</li>`;
      })
      .join('') +
    '</ul>'
  );
}

// The product's Pricing page; with none in the docs, it is priced by plan, so point at the plans.
function pricingOf(p) {
  if (p.pricing) return { url: p.pricing, label: 'Pricing' };
  const plans = curated.plans?.[p.group];
  return plans ? { url: plans, label: 'Plans' } : null;
}

function renderRow(p) {
  const name = link(p.www || p.docs, text(p.name), 'product');
  const docs = link(p.docs, 'Docs', 'more');
  const site = p.www ? ' · ' + link(p.www, 'Product page', 'more') : '';
  const price = pricingOf(p);
  const pricing = price ? link(price.url, price.label, 'more') : '';
  const search = [p.name, p.group, p.description, ...(p.alternatives || []).map((a) => a.name)]
    .join(' ')
    .toLowerCase();
  return `
          <tr data-search="${esc(search)}">
            <th scope="row">${name}</th>
            <td data-label="What it does">${text(p.description)}<br>${docs}${site}</td>
            <td data-label="Alternatives">${renderAlternatives(p.alternatives)}</td>
            <td data-label="Cost">${p.cost ? text(p.cost) : '<span class="none">—</span>'}${pricing ? (p.cost ? '<br>' : '') + pricing : ''}</td>
          </tr>`;
}

function renderGroup(group, products) {
  const id = group.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `
      <section id="${id}">
        <h2>${text(group)} <span class="count">${products.length}</span></h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">What it does</th>
              <th scope="col">Alternatives, if we move</th>
              <th scope="col">Cost</th>
            </tr>
          </thead>
          <tbody>${products.map(renderRow).join('')}
          </tbody>
        </table>
      </section>`;
}

async function render(groups, total, today, checked, skipped) {
  const template = await readFile(join(ROOT, 'tools', 'cloudflare.html'), 'utf8');
  const nav = groups
    .map(([g, ps]) => link('#' + g.toLowerCase().replace(/[^a-z0-9]+/g, '-'), `${text(g)} <span class="count">${ps.length}</span>`))
    .join('\n          ');
  const slots = {
    total: String(total),
    date: today,
    checked,
    nav,
    groups: groups.map(([g, ps]) => renderGroup(g, ps)).join('\n'),
    skipped: skipped.map((s) => `<li>${link(s.docs, text(s.name))} — ${text(s.reason)}</li>`).join('\n        '),
  };
  // A function, so the "$" in prices is never read as a replacement pattern.
  return template.replace(/{{(\w+)}}/g, (_, key) => slots[key]);
}

// The same matrix as Markdown, for AI tools and anything else that reads text.
function renderMarkdown(groups, total, today, checked, skipped) {
  const cell = (s = '') => smart(s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
  const md = (label, url) => `[${cell(label)}](${url})`;
  const out = [
    '# Cloudflare',
    '',
    `> All ${total} Cloudflare products: what each does, what it costs, and where we would go if we had to move.`,
    '',
    `HTML version: ${SITE}/cloudflare/ · Parsed from developers.cloudflare.com and cloudflare.com on ${today}; costs and alternatives checked by hand on ${checked}.`,
    '',
  ];
  for (const [group, ps] of groups) {
    out.push(`## ${group}`, '', '| Product | What it does | Alternatives, if we move | Cost |', '| --- | --- | --- | --- |');
    for (const p of ps) {
      const links = [md('Docs', p.docs), p.www && md('Product page', p.www)].filter(Boolean).join(' · ');
      const alts = (p.alternatives || [])
        .map((a) => (a.url ? md(a.name, a.url) : cell(a.name)) + (a.note ? ` (${cell(a.note)})` : ''))
        .join('; ');
      const price = pricingOf(p);
      const cost = [cell(p.cost) || '—', price && md(price.label, price.url)].filter(Boolean).join(' · ');
      out.push(`| ${md(p.name, p.www || p.docs)} | ${cell(p.description)} · ${links} | ${alts || '—'} | ${cost} |`);
    }
    out.push('');
  }
  out.push('## Left out', '', 'Not products on their own:', '');
  for (const sk of skipped) out.push(`- ${md(sk.name, sk.docs)} — ${cell(sk.reason)}`);
  out.push(
    '',
    '## Disclaimers',
    '',
    '- This website is crawled and generated by an LLM, and nothing here is personal. Everything is for information only, as is; we take no responsibility for it.',
    '- We are not affiliated with Cloudflare, or with any of the products and services mentioned here. This is our own research, so we are ready when we need it.',
    '- Prices change; the Pricing link on the respective source is the truth.',
    '',
  );
  return out.join('\n');
}

// --- main ---------------------------------------------------------------------------------------

await mkdir(CACHE, { recursive: true });
const curated = JSON.parse(await readFile(join(ROOT, 'data', 'cloudflare.json'), 'utf8'));
const entries = curated.products;
const warnings = [];

// 1. Every product the docs know about.
const directory = parseDirectory(await get(`${DOCS}/llms.txt`));
console.log(`docs: ${directory.length} entries`);

// 2. Each one's Pricing page.
await pool(directory, 8, async (p) => {
  p.pricing = findPricing(await get(`${p.docs}llms.txt`));
});

// 3. Every marketing page, and what it says about itself.
const sitemap = parseSitemap(await get(`${WWW}/sitemap.xml`));
const meta = Object.fromEntries(
  await pool(sitemap, 8, async (slug) => [slug, parseMeta(await get(`${WWW}/products/${slug}`))]),
);
console.log(`www:  ${sitemap.length} product pages`);

// 4. Merge with the hand-written data.
const products = [];
const skipped = [];
const claimed = new Set();
for (const p of directory) {
  const c = entries[p.id];
  if (!c) {
    warnings.push(`new in docs, not in data/cloudflare.json: ${p.id} (${p.name})`);
    products.push(p);
    continue;
  }
  if (c.skip) {
    skipped.push({ ...p, reason: c.reason || '' });
    continue;
  }
  products.push(merge(p, c));
}
// Products with a marketing page but no top-level docs entry, e.g. Access, Gateway, Bot Management.
for (const [id, c] of Object.entries(entries)) {
  if (c.skip || directory.some((p) => p.id === id)) continue;
  if (!c.docs) {
    warnings.push(`in data/cloudflare.json, gone from docs: ${id}`);
    continue;
  }
  const m = c.www ? meta[c.www] : null;
  products.push(
    merge({ id, name: c.name || m?.title || id, group: c.group, docs: c.docs, description: m?.description || '' }, c),
  );
}

function merge(p, c) {
  for (const slug of [].concat(c.www || [])) claimed.add(slug);
  const www = [].concat(c.www || [])[0];
  if (www && !sitemap.includes(www)) warnings.push(`marketing page gone from sitemap: /products/${www} (${p.id})`);
  return {
    ...p,
    name: c.name || p.name,
    group: c.group || p.group,
    docs: c.docs || p.docs,
    www: www ? `${WWW}/products/${www}/` : '',
    description: c.description || p.description,
    pricing: c.pricing ?? p.pricing ?? '',
    alternatives: c.alternatives || [],
    cost: c.cost || '',
  };
}

for (const slug of sitemap) {
  if (!claimed.has(slug) && !(curated.ignoreWww || []).includes(slug)) {
    warnings.push(`new marketing page, not in data/cloudflare.json: /products/${slug} — ${meta[slug].title}`);
  }
}
for (const p of products) {
  if (!p.cost) warnings.push(`no cost: ${p.id}`);
  if (!p.alternatives?.length) warnings.push(`no alternatives: ${p.id}`);
}

// 5. Group, in the docs' own order of categories, products A–Z within each.
const order = curated.groupOrder || [];
const byGroup = new Map();
for (const p of products) {
  if (!byGroup.has(p.group)) byGroup.set(p.group, []);
  byGroup.get(p.group).push(p);
}
const groups = [...byGroup.entries()]
  .sort(([a], [b]) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  })
  .map(([g, ps]) => [g, ps.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))]);

if (failures || directory.length < 50 || sitemap.length < 30) {
  console.error(`\nStopped without writing: ${failures} failed fetches, ${directory.length} docs entries, ${sitemap.length} product pages.`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const checked = curated.checked || today;
await writeFile(join(ROOT, 'cloudflare', 'index.html'), await render(groups, products.length, today, checked, skipped));
await writeFile(join(ROOT, 'cloudflare.md'), renderMarkdown(groups, products.length, today, checked, skipped));
console.log(`wrote cloudflare/index.html and cloudflare.md: ${products.length} products in ${groups.length} groups`);

if (warnings.length) {
  console.log(`\n${warnings.length} to look at:`);
  for (const w of warnings) console.log('  - ' + w);
}
if (WARNINGS) await writeFile(WARNINGS, warnings.map((w) => `- ${w}`).join('\n') + (warnings.length ? '\n' : ''));
