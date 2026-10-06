// This game has no text-entry controls. Keep engine IME helpers from opening
// a software keyboard while preserving the canvas's hardware keyboard events.
(() => {
  if (!matchMedia('(pointer: coarse)').matches) return;
  const selector = 'input, textarea, [contenteditable], .ime';
  const isEditable = element => element && typeof element.matches === 'function' && element.matches(selector);
  const lockTextEntry = element => {
    if (!isEditable(element)) return;
    if (element.getAttribute('inputmode') !== 'none') element.setAttribute('inputmode', 'none');
    if (element.hasAttribute('contenteditable') && element.getAttribute('contenteditable') !== 'false') {
      element.setAttribute('contenteditable', 'false');
    }
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      if (!element.readOnly) element.readOnly = true;
      if (!element.disabled) element.disabled = true;
    }
    if (document.activeElement === element) element.blur();
  };
  const dismissKeyboard = () => {
    const active = document.activeElement;
    if (isEditable(active)) active.blur();
  };
  document.querySelectorAll(selector).forEach(lockTextEntry);
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') lockTextEntry(record.target);
      for (const node of record.addedNodes || []) {
        lockTextEntry(node);
        if (node.querySelectorAll) node.querySelectorAll(selector).forEach(lockTextEntry);
      }
    }
  }).observe(document.body, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['contenteditable', 'inputmode', 'readonly', 'disabled']
  });
  document.addEventListener('focusin', event => lockTextEntry(event.target), true);
  document.addEventListener('pointerdown', dismissKeyboard, true);
  addEventListener('orientationchange', () => {
    dismissKeyboard();
    setTimeout(dismissKeyboard, 150);
    setTimeout(dismissKeyboard, 450);
  });
  addEventListener('resize', dismissKeyboard);
})();
