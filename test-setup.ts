import { Window } from "happy-dom";

// Set test environment
(process.env as any).NODE_ENV = "test";
(process.env as any).LOG_LEVEL = "silent";

// Ensure requestAnimationFrame and cancelAnimationFrame are defined early
// This prevents "ReferenceError: requestAnimationFrame is not defined" in CI
if (typeof global.requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    return setTimeout(callback, 0) as any;
  }) as any;
}

if (typeof global.cancelAnimationFrame === 'undefined') {
  global.cancelAnimationFrame = ((id: number) => {
    clearTimeout(id);
  }) as any;
}

// Set up happy-dom for all tests
const window = new Window();
const document = window.document;

global.window = window as any;
global.document = document as any;
global.navigator = window.navigator as any;
global.HTMLElement = window.HTMLElement as any;
global.Element = window.Element as any;
global.localStorage = window.localStorage as any;

// Propagate animation frame APIs from happy-dom window
// happy-dom v20+ includes these, so use them if available, otherwise fallback to setTimeout
if (typeof window.requestAnimationFrame === 'function') {
  global.requestAnimationFrame = window.requestAnimationFrame.bind(window) as any;
} else {
  global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    return setTimeout(callback, 0);
  }) as any;
}

if (typeof window.cancelAnimationFrame === 'function') {
  global.cancelAnimationFrame = window.cancelAnimationFrame.bind(window) as any;
} else {
  global.cancelAnimationFrame = ((id: number) => {
    clearTimeout(id);
  }) as any;
}

// Mock MutationObserver for MDXEditor
global.MutationObserver = class MutationObserver {
  constructor(callback: MutationCallback) {}
  disconnect() {}
  observe(target: Node, options?: MutationObserverInit) {}
  takeRecords(): MutationRecord[] {
    return [];
  }
} as any;
