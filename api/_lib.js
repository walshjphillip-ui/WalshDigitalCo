/* Shared helpers for the Audit Desk functions. Files starting with an
   underscore are not deployed as routes by Vercel. */
'use strict';

const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');

/* Every desk endpoint is gated by DESK_KEY (Vercel → Settings → Environment
   Variables). Unset means the feature is off, not open. */
function authorised(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method', message: 'POST only.' });
    return false;
  }
  const expected = process.env.DESK_KEY;
  if (!expected) {
    res.status(503).json({ error: 'not_configured',
      message: 'Scanning is off: add a DESK_KEY environment variable in Vercel and redeploy.' });
    return false;
  }
  const got = Buffer.from(String(req.headers['x-desk-key'] || ''));
  const want = Buffer.from(expected);
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) {
    res.status(401).json({ error: 'unauthorised', message: 'Desk key missing or wrong — check Settings.' });
    return false;
  }
  return true;
}

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}

/* ── SSRF guard: only public addresses on standard web ports ── */
function privateV4(ip) {
  const p = ip.split('.').map(Number);
  return p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 192 && p[1] === 0 && p[2] === 0) ||
    (p[0] === 198 && (p[1] === 18 || p[1] === 19));
}
function privateIp(ip) {
  if (net.isIPv4(ip)) return privateV4(ip);
  const v = ip.toLowerCase();
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return privateV4(mapped[1]);
  return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith('ff');
}
async function assertPublicUrl(u) {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http and https addresses can be scanned.');
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('Only standard web ports can be scanned.');
  if (u.username || u.password) throw new Error('Addresses with credentials are not scanned.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some(a => privateIp(a.address))) throw new Error('That address is not a public website.');
}

module.exports = { authorised, body, assertPublicUrl, privateIp };
