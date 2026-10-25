// Mobile uses CSS-sized rendering instead of a retina-sized framebuffer.
// Godot keeps its normal input coordinate conversion; CSS and touch targets stay the same size.
(() => {
  const MAX_EDGE = 1280;
  globalThis.AshfallPerformance = {
    configure(config) {
      if (!matchMedia('(pointer: coarse)').matches) return;
      const canvas = document.getElementById('canvas');
      if (!canvas) return;
      config.canvasResizePolicy = 0; // The host owns the backing size, including rotation.
      const resize = () => {
        const width = Math.max(1, innerWidth);
        const height = Math.max(1, innerHeight);
        const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
        const w = Math.max(1, Math.round(width * scale));
        const h = Math.max(1, Math.round(height * scale));
        // Setting an unchanged canvas size can clear the context unnecessarily.
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
      };
      addEventListener('resize', resize);
      addEventListener('orientationchange', resize);
      resize();
    }
  };
})();
