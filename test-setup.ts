import { Window } from "happy-dom";

// Set test environment
process.env.NODE_ENV = "test";

// Set up happy-dom for all tests
const window = new Window();
const document = window.document;

global.window = window as any;
global.document = document as any;
global.navigator = window.navigator as any;
global.HTMLElement = window.HTMLElement as any;
global.Element = window.Element as any;
