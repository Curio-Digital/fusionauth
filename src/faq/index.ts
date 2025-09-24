type FaqItemElements = {
  item: HTMLElement;
  questionWrapper: HTMLElement | null;
  questionTitle: HTMLElement | null;
  answer: HTMLElement | null;
};

declare global {
  interface Window {
    __faqSearchInitialized?: boolean;
  }
}

const OPENED_ATTR = 'data-opened-by-search';
const HIGHLIGHT_CLASS = 'faq-search-highlight';
const HIGHLIGHT_TAG = 'mark';

// Track wrappers we've already tagged with a click listener
const clickTaggedWrappers = new WeakSet<HTMLElement>();
const searchOpenedItems = new Set<HTMLElement>();

const ready = (fn: () => void): void => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
};

const normalizeText = (text: string): string => text.toLowerCase().trim();

const debounce = (
  fn: (...args: unknown[]) => void,
  delay: number
): ((...args: unknown[]) => void) => {
  let timeoutId: number | undefined;
  return (...args: unknown[]) => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => {
      fn(...args);
    }, delay);
  };
};

const collectFaqItems = (scope: ParentNode): FaqItemElements[] => {
  const items = Array.from(scope.querySelectorAll<HTMLElement>('.bvb-faq-item'));
  return items.map((item) => {
    const questionWrapper = item.querySelector<HTMLElement>('.bvb-faq-item_question');
    const questionTitle = item.querySelector<HTMLElement>('.bvb-faq-item_question h3');
    const answer = item.querySelector<HTMLElement>('.faq-item_rich-text');
    return { item, questionWrapper, questionTitle, answer };
  });
};

const isMatch = (el: HTMLElement | null, q: string): boolean => {
  if (!el) return false;
  return normalizeText(el.textContent || '').includes(q);
};

const itemMatchesQuery = (els: FaqItemElements, q: string): boolean => {
  return isMatch(els.questionTitle, q) || isMatch(els.answer, q);
};

const clearHighlights = (container: HTMLElement): void => {
  const marks = Array.from(container.querySelectorAll(`${HIGHLIGHT_TAG}.${HIGHLIGHT_CLASS}`));
  marks.forEach((mark) => {
    const parent = mark.parentNode as Node | null;
    if (!parent) return;
    // Replace mark with its text content
    parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
    // Normalize adjacent text nodes
    parent.normalize?.();
  });
};

const isElementVisible = (el: HTMLElement): boolean => {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const isFaqItemOpen = (els: FaqItemElements): boolean => {
  if (els.answer) return isElementVisible(els.answer);
  const expanded =
    els.item.getAttribute('aria-expanded') === 'true' ||
    els.questionWrapper?.getAttribute('aria-expanded') === 'true';
  return Boolean(expanded);
};

const highlightMatchesInElement = (container: HTMLElement, query: string): void => {
  if (!query) return;
  const q = normalizeText(query);

  // We will walk text nodes and wrap occurrences in <mark>
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.nodeValue || '';
      return normalizeText(text).includes(q) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });

  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    const original = textNode.nodeValue || '';
    const lower = normalizeText(original);

    // Build a fragment with highlighted parts
    const frag = document.createDocumentFragment();
    let pos = 0;

    const pushText = (s: string) => frag.appendChild(document.createTextNode(s));
    const pushMark = (s: string) => {
      const mark = document.createElement(HIGHLIGHT_TAG);
      mark.className = HIGHLIGHT_CLASS;
      mark.textContent = s;
      frag.appendChild(mark);
    };

    while (true) {
      const idx = lower.indexOf(q, pos);
      if (idx === -1) {
        pushText(original.slice(pos));
        break;
      }
      if (idx > pos) pushText(original.slice(pos, idx));
      pushMark(original.slice(idx, idx + q.length));
      pos = idx + q.length;
    }

    const parent = textNode.parentNode;
    if (!parent) return;
    parent.replaceChild(frag, textNode);
  });
};

const openFaqItem = (els: FaqItemElements): void => {
  if (!els.questionWrapper) return;
  // Avoid toggling closed if we already opened this via search
  if (els.item.getAttribute(OPENED_ATTR) === 'true') return;
  // Simulate user click to trigger Webflow interaction
  els.questionWrapper.click();
  els.item.setAttribute(OPENED_ATTR, 'true');
  searchOpenedItems.add(els.item);
};

const ensureClickTagging = (items: FaqItemElements[]): void => {
  items.forEach((els) => {
    if (!els.questionWrapper) return;
    if (clickTaggedWrappers.has(els.questionWrapper)) return;
    clickTaggedWrappers.add(els.questionWrapper);
    els.questionWrapper.addEventListener('click', () => {
      els.item.setAttribute(OPENED_ATTR, 'true');
    });
  });
};

const scrollIntoViewIfNeeded = (el: HTMLElement): void => {
  try {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch {
    el.scrollIntoView();
  }
};

const findFirstMatchAndAct = (items: FaqItemElements[], query: string): void => {
  const q = normalizeText(query);
  if (!q) return;

  // Clear previous highlights in this FAQ scope
  items.forEach(({ item }) => clearHighlights(item));

  // Find matches
  let firstMatchAnchor: HTMLElement | null = null;
  let firstMatchedItem: FaqItemElements | null = null;

  items.forEach((els) => {
    const questionMatches = isMatch(els.questionTitle, q);
    const answerMatches = isMatch(els.answer, q);

    if (questionMatches || answerMatches) {
      // highlight within both question and answer
      if (els.questionTitle) highlightMatchesInElement(els.questionTitle, q);
      if (els.answer) highlightMatchesInElement(els.answer, q);

      if (!firstMatchedItem) {
        firstMatchedItem = els;
        // Prefer an inner highlight to scroll to
        const anchor = els.item.querySelector(
          `${HIGHLIGHT_TAG}.${HIGHLIGHT_CLASS}`
        ) as HTMLElement | null;
        firstMatchAnchor = anchor || els.item;
      }
    }
  });

  if (firstMatchedItem) {
    // If the anchor is within the item, scroll to it first (even if collapsed)
    if (firstMatchAnchor) scrollIntoViewIfNeeded(firstMatchAnchor);
    // Then open the item to reveal content
    openFaqItem(firstMatchedItem);
  }
};

const attachSearchHandlerToInput = (input: HTMLInputElement, items: FaqItemElements[]): void => {
  const onSearch = () => {
    const value = input.value || '';
    if (!value.trim()) {
      items.forEach(({ item }) => clearHighlights(item));
      // Close any items that were opened by search
      items.forEach((els) => {
        if (searchOpenedItems.has(els.item)) {
          if (isFaqItemOpen(els) && els.questionWrapper) {
            els.questionWrapper.click();
          }
          els.item.removeAttribute(OPENED_ATTR);
          searchOpenedItems.delete(els.item);
        }
      });
      return;
    }
    const q = normalizeText(value);
    // For non-empty queries, close only those previously search-opened items
    // that no longer match the current query. Keep matching items open.
    items.forEach((els) => {
      if (searchOpenedItems.has(els.item) && !itemMatchesQuery(els, q)) {
        if (isFaqItemOpen(els) && els.questionWrapper) {
          els.questionWrapper.click();
        }
        els.item.removeAttribute(OPENED_ATTR);
        searchOpenedItems.delete(els.item);
      }
    });
    findFirstMatchAndAct(items, value);
  };

  const onSearchDebounced = debounce(onSearch, 200);

  // Prevent form submission on Enter
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  input.addEventListener('input', onSearchDebounced);
};

const init = (): void => {
  if (window.__faqSearchInitialized) return;
  window.__faqSearchInitialized = true;

  // Minimal style for highlight if none provided
  if (!document.getElementById('faq-search-highlight-style')) {
    const style = document.createElement('style');
    style.id = 'faq-search-highlight-style';
    style.textContent = `.${HIGHLIGHT_CLASS}{ background: var(--indigo-100); padding: 0 .1em; }`;
    document.head.appendChild(style);
  }

  // Global search across the entire page
  const items = collectFaqItems(document);
  ensureClickTagging(items);

  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('[faq-search]'));
  inputs.forEach((input) => attachSearchHandlerToInput(input, items));
};

ready(init);

export {};
