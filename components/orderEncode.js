/**
 * Encode/decode order data ke string yang aman untuk URL.
 * Format: base64url dari JSON dengan field-name pendek.
 */

function toBase64Url(str) {
  if (typeof window === 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(b64) {
  const pad = b64.length % 4;
  const padded = b64 + '='.repeat(pad ? 4 - pad : 0);
  const normal = padded.replace(/-/g, '+').replace(/_/g, '/');
  if (typeof window === 'undefined') {
    return Buffer.from(normal, 'base64').toString('utf-8');
  }
  const bin = atob(normal);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/* Compact mapping
 * v   : version
 * i   : orderId
 * t   : created timestamp (ms epoch)
 * c.n : customer.name
 * c.p : customer.phone
 * k.t : pickup.type ('n'|'l')
 * k.m : pickup.time
 * s.c : store.code
 * s.n : store.name
 * s.a : store.address
 * x[] : items: [{n,v?,p,q,c?}]
 *   n : name
 *   v : variant
 *   p : price
 *   q : qty
 *   c : product_code
 * sb  : subtotal
 * os  : origSubtotal
 * d   : discount
 * dc  : discountCapped (1|0)
 * f   : serviceFee
 * tt  : total
 */

function compact(o) {
  const out = { v: 1 };
  if (o.orderId) out.i = o.orderId;
  if (o.createdAt) {
    const t = typeof o.createdAt === 'number' ? o.createdAt : Date.parse(o.createdAt);
    if (!isNaN(t)) out.t = t;
  }
  if (o.customer) {
    out.c = {};
    if (o.customer.name) out.c.n = o.customer.name;
    if (o.customer.phone) out.c.p = o.customer.phone;
  }
  if (o.pickup) {
    out.k = { t: o.pickup.type === 'later' ? 'l' : 'n' };
    if (o.pickup.time) out.k.m = o.pickup.time;
  }
  if (o.store) {
    out.s = {};
    if (o.store.code) out.s.c = o.store.code;
    if (o.store.name) out.s.n = o.store.name;
    if (o.store.address) out.s.a = o.store.address;
  }
  if (Array.isArray(o.items)) {
    out.x = o.items.map((it) => {
      const obj = { n: it.name, p: Number(it.price) || 0, q: Number(it.qty) || 1 };
      if (it.variant) obj.v = it.variant;
      if (it.product_code) obj.c = it.product_code;
      if (it.image) obj.m = it.image;
      return obj;
    });
  }
  if (o.subtotal != null) out.sb = o.subtotal;
  if (o.origSubtotal != null) out.os = o.origSubtotal;
  if (o.discount != null) out.d = o.discount;
  if (o.discountCapped) out.dc = 1;
  if (o.serviceFee != null) out.f = o.serviceFee;
  if (o.total != null) out.tt = o.total;
  if (o.uniqueCode != null) out.uc = o.uniqueCode;
  if (o.totalToPay != null) out.tp = o.totalToPay;
  return out;
}

function expand(c) {
  if (!c) return null;
  return {
    orderId: c.i || '',
    createdAt: c.t ? new Date(c.t).toISOString() : null,
    customer: c.c ? { name: c.c.n || '', phone: c.c.p || '' } : null,
    pickup: c.k ? { type: c.k.t === 'l' ? 'later' : 'now', time: c.k.m || '' } : null,
    store: c.s
      ? { code: c.s.c || '', name: c.s.n || '', address: c.s.a || '' }
      : null,
    items: Array.isArray(c.x)
      ? c.x.map((it) => ({
          name: it.n || '',
          variant: it.v || '',
          price: Number(it.p) || 0,
          qty: Number(it.q) || 1,
          product_code: it.c || '',
          image: it.m || '',
        }))
      : [],
    subtotal: c.sb ?? 0,
    origSubtotal: c.os ?? 0,
    discount: c.d ?? 0,
    discountCapped: !!c.dc,
    serviceFee: c.f ?? 0,
    total: c.tt ?? 0,
    uniqueCode: c.uc ?? null,
    totalToPay: c.tp ?? null,
  };
}

export function encodeOrder(order) {
  return toBase64Url(JSON.stringify(compact(order)));
}

export function decodeOrder(token) {
  try {
    return expand(JSON.parse(fromBase64Url(token)));
  } catch (e) {
    return null;
  }
}

export function generateOrderId() {
  const d = new Date();
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KK${y}${m}${day}-${rand}`;
}
