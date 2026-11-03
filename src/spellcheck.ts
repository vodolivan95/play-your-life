const SPELLCHECKABLE_SELECTOR = [
  'textarea',
  'input:not([type])',
  'input[type="text"]',
  'input[type="search"]',
  '[contenteditable="true"]',
].join(',');

function enableSpellcheck(node: ParentNode): void {
  if (node instanceof Element && node.matches(SPELLCHECKABLE_SELECTOR)) {
    node.setAttribute('spellcheck', 'true');
  }

  node.querySelectorAll(SPELLCHECKABLE_SELECTOR).forEach(element => {
    element.setAttribute('spellcheck', 'true');
  });
}

/** Use the browser's native spellchecker so its installed dictionaries provide suggestions. */
export function enableNativeSpellcheck(): void {
  enableSpellcheck(document);

  const observer = new MutationObserver(records => {
    records.forEach(record => {
      record.addedNodes.forEach(node => {
        if (node instanceof Element) enableSpellcheck(node);
      });
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
}
