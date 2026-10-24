// Serve the engine compressed so the first phone download stays small.
(() => {
  const fetchOriginal = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, options) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
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
  const updateOrientation = () => {
    document.documentElement.classList.toggle('portrait-phone',
      matchMedia('(orientation: portrait)').matches && matchMedia('(pointer: coarse)').matches);
  };
  addEventListener('resize', updateOrientation);
  addEventListener('orientationchange', updateOrientation);
  updateOrientation();
  // Offline cache (dist/sw.js): registered after the page has loaded so it never competes with the first download.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
