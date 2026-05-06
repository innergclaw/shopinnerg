#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const PAYMENT_LINK_ID = 'plink_1TU9Y3QPiPou53Wc0j6aEdsQ';
const PAYMENT_LINK_URL = 'https://buy.stripe.com/5kQ8wRgALcSB3T0cyfao80U';
const PRODUCT_NAME = '15 Plug & Play Flyer Templates (Just Add Your Photos)';
const OUT_FILE = path.resolve(process.cwd(), 'tracker/flyer-template-stats.json');

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  console.error('Missing STRIPE_SECRET_KEY');
  process.exit(1);
}

async function stripe(pathname, search = new URLSearchParams()) {
  const url = new URL(`https://api.stripe.com${pathname}`);
  url.search = search.toString();
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${secret}`
    }
  });

  if (!res.ok) {
    throw new Error(`Stripe request failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

async function getSessions() {
  const sessions = [];
  let startingAfter = null;

  while (true) {
    const search = new URLSearchParams({
      payment_link: PAYMENT_LINK_ID,
      limit: '100'
    });

    if (startingAfter) search.set('starting_after', startingAfter);

    const page = await stripe('/v1/checkout/sessions', search);
    sessions.push(...(page.data || []));

    if (!page.has_more || !page.data?.length) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  return sessions;
}

const sessions = await getSessions();
const paid = sessions.filter((session) => session.payment_status === 'paid');
const grossRevenue = paid.reduce((sum, session) => sum + Number(session.amount_total || 0), 0);
const currency = sessions[0]?.currency || 'usd';

const payload = {
  productName: PRODUCT_NAME,
  paymentLinkId: PAYMENT_LINK_ID,
  paymentLinkUrl: PAYMENT_LINK_URL,
  currency,
  salesCount: paid.length,
  grossRevenue,
  checkoutSessions: sessions.length,
  lastUpdated: new Date().toISOString()
};

await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
await fs.writeFile(OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
console.log(`Updated ${OUT_FILE}`);
console.log(JSON.stringify(payload, null, 2));
