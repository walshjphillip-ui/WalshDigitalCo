/* Audit Desk — Google Business Profile lookup (Places API, New).
   POST { business, location } with header x-desk-key.
   Needs GOOGLE_PLACES_API_KEY in Vercel with "Places API (New)" enabled.
   Returns up to three candidates so the desk can confirm it found the right one. */
'use strict';

const { authorised, body } = require('./_lib');

const FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.rating', 'places.userRatingCount',
  'places.reviews', 'places.photos', 'places.regularOpeningHours', 'places.websiteUri', 'places.googleMapsUri',
  'places.businessStatus', 'places.primaryTypeDisplayName', 'places.nationalPhoneNumber'
].join(',');

module.exports = async function handler(req, res) {
  if (!authorised(req, res)) return;
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return res.status(503).json({ error: 'not_configured',
    message: 'Google lookup is off: add GOOGLE_PLACES_API_KEY in Vercel (Places API (New) enabled).' });

  const b = body(req);
  const q = [b.business, b.location].map(s => String(s || '').trim()).filter(Boolean).join(', ');
  if (!b.business) return res.status(400).json({ error: 'query', message: 'Add the business name first.' });

  try {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
      body: JSON.stringify({ textQuery: q, maxResultCount: 3 }),
      signal: AbortSignal.timeout(8000)
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: 'places', message: (j.error && j.error.message) || 'Places lookup failed.' });

    const now = Date.now();
    const candidates = (j.places || []).map(p => {
      const times = (p.reviews || []).map(rv => Date.parse(rv.publishTime)).filter(Number.isFinite);
      const latest = times.length ? Math.max(...times) : null;
      return {
        name: p.displayName && p.displayName.text,
        address: p.formattedAddress || null,
        category: p.primaryTypeDisplayName && p.primaryTypeDisplayName.text,
        status: p.businessStatus || null,
        rating: p.rating ?? null,
        reviews: p.userRatingCount ?? 0,
        // the API returns at most five reviews, so this is "newest of those", a floor on recency
        latestReviewDays: latest ? Math.round((now - latest) / 86400000) : null,
        photos: (p.photos || []).length,          // capped at 10 by the API
        hasHours: !!(p.regularOpeningHours && p.regularOpeningHours.weekdayDescriptions),
        website: p.websiteUri || null,
        phone: p.nationalPhoneNumber || null,
        mapsUrl: p.googleMapsUri || null
      };
    });
    res.status(200).json({ query: q, candidates });
  } catch (e) {
    res.status(502).json({ error: 'places', message: e.name === 'TimeoutError' ? 'Google took too long to answer.' : e.message });
  }
};
