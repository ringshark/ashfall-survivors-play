// Serve the engine compressed so the first phone download stays small.
(() => {
  const fetchOriginal = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, options) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    if (url.pathname.endsWith('/art.pck')) {
      const response = await fetchOriginal(input, options);
      if (!response.ok || response.status !== 200) return response;
      // Cache Storage can deliver tiny chunks. Godot polls one browser chunk per
      // frame, so coalesce first, then pass views matching its 4 MiB read size.
      const bytes = new Uint8Array(await response.arrayBuffer());
      let offset = 0;
      const body = new ReadableStream({ pull(controller) {
        if (offset === bytes.length) { controller.close(); return; }
        const end = Math.min(offset + 4194304, bytes.length);
        controller.enqueue(bytes.subarray(offset, end));
        offset = end;
      }});
      const headers = new Headers(response.headers);
      headers.delete('Content-Encoding');
      headers.set('Content-Length', String(bytes.length));
      return new Response(body, { status: response.status, statusText: response.statusText, headers });
    }
    if (!url.pathname.endsWith('/index.wasm')) return fetchOriginal(input, options);
    const response = await fetchOriginal(new URL('index.wasm.gz', location.href), options);
    if (!response.ok) throw new Error('The game could not download. Reload to try again.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let body = bytes;
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      if (!globalThis.DecompressionStream) throw new Error('Please open the game in an updated Safari or Chrome browser.');
      body = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    }
    return new Response(body, { headers: { 'Content-Type': 'application/wasm' } });
  };
  // Offline cache (dist/sw.js): registered after the page has loaded so it never competes with the first download.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
