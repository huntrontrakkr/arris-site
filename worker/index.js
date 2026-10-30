/* The site is its files (wrangler.jsonc, assets): this Worker runs first
 * only for /media/*, to answer byte-range requests, which the asset server
 * answers with the whole file. Safari will not play a film without them,
 * and the board film seeks as the page scrolls. One range is answered from
 * the asset itself; several, or none, get the whole file. */
export default {
  async fetch(request, env) {
    const range = request.headers.get('Range');
    if (!range || !['GET', 'HEAD'].includes(request.method)) {
      const res = await env.ASSETS.fetch(request);
      if (res.status !== 200) return res;
      const out = new Response(res.body, res);
      out.headers.set('Accept-Ranges', 'bytes');
      return out;
    }
    const res = await env.ASSETS.fetch(new Request(request.url));
    if (res.status !== 200) return res;
    const body = await res.arrayBuffer(), size = body.byteLength;
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    const headers = new Headers(res.headers);
    headers.set('Accept-Ranges', 'bytes');
    if (!m || (m[1] === '' && m[2] === '')) return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers });
    // bytes=a-b, bytes=a- or the last n bytes, bytes=-n
    const start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
    const end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' } });
    }
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(request.method === 'HEAD' ? null : body.slice(start, end + 1), { status: 206, headers });
  },
};
