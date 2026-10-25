// Keep this hook for generated exports, but let Godot own both framebuffer and
// CSS sizing. Manually changing one on iOS rotation/restore can stretch the game.
// Low-density web rendering is configured by allow_hidpi.web=false in Godot.
(() => {
  globalThis.AshfallPerformance = {
    configure(config) {
      config.canvasResizePolicy = 2;
    }
  };
})();
