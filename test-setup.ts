import { Window } from "happy-dom";
import { vi } from "vitest";

// Set test environment
(process.env as any).NODE_ENV = "test";
(process.env as any).LOG_LEVEL = "silent";
(process.env as any).TZ = "UTC"; // Force UTC timezone for consistent date handling

// Mock logger globally for all tests - we don't need real logging in tests
vi.mock("@/lib/logger", () => {
  const createMockLogger = (): any => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  });

  return {
    getLogger: createMockLogger,
    getBaseLogger: createMockLogger,
    createLogger: vi.fn(createMockLogger),
  };
});

// Mock Next.js Image component for tests
vi.mock("next/image", () => ({
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return require("react").createElement("img", { ...props });
  },
}));

// Mock MarkdownEditor globally to avoid duplication in component tests
// This avoids browser API dependencies (MDXEditor uses lexical which needs DOM APIs)
vi.mock("@/components/Markdown/MarkdownEditor", () => {
  const { forwardRef, useImperativeHandle, useState, useEffect } = require("react");
  
  const MarkdownEditorMock = forwardRef(
    (props: any, ref: any) => {
      const { value, onChange, placeholder, height, id, autoFocus, editorRef } = props;
      const [internalValue, setInternalValue] = useState(value);
      const actualRef = editorRef || ref;

      useEffect(() => {
        if (value !== internalValue) {
          setInternalValue(value);
        }
      }, [value, internalValue]);

      useImperativeHandle(actualRef, () => ({
        setMarkdown: (markdown: string) => {
          setInternalValue(markdown);
          onChange(markdown);
        },
        getMarkdown: () => internalValue,
        focus: () => {},
        insertMarkdown: () => {},
        getContentEditableHTML: () => internalValue,
        getSelectionMarkdown: () => "",
      }));

      return require("react").createElement(
        "div",
        { "data-testid": "markdown-editor-mock" },
        require("react").createElement("textarea", {
          value: internalValue,
          onChange: (e: any) => {
            setInternalValue(e.target.value);
            onChange(e.target.value);
          },
          placeholder,
          id,
          autoFocus,
          "data-testid": "markdown-editor",
          style: height !== undefined ? { height: `${height}px` } : undefined,
        })
      );
    }
  );

  MarkdownEditorMock.displayName = "MarkdownEditor";

  return {
    default: MarkdownEditorMock
  };
});

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

// Suppress React 18 act() warnings in tests - these are caused by animations and async state updates
// that don't affect test correctness. The warnings occur when BaseModal uses requestAnimationFrame
// for entrance/exit animations, which are implementation details we don't need to test.
const originalError = console.error;
console.error = (...args: any[]) => {
  const message = typeof args[0] === 'string' ? args[0] : '';
  if (message.includes('An update to') && message.includes('inside a test was not wrapped in act')) {
    return;
  }
  originalError.call(console, ...args);
};
