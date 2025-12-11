import { Window } from "happy-dom";

// Set test environment
(process.env as any).NODE_ENV = "test";
(process.env as any).LOG_LEVEL = "silent";

// Set up happy-dom for all tests
const window = new Window();
const document = window.document;

global.window = window as any;
global.document = document as any;
global.navigator = window.navigator as any;
global.HTMLElement = window.HTMLElement as any;
global.Element = window.Element as any;
global.localStorage = window.localStorage as any;
