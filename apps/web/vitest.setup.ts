import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Testing Library's automatic afterEach(cleanup) registration relies on detecting a global
// `afterEach` — this project imports `afterEach` explicitly from "vitest" per file rather
// than enabling `test.globals: true`, so that auto-detection never fires. Without this, DOM
// nodes from one test's render() leak into the next test in the same file (queries like
// `getByTestId` then match more than one element).
afterEach(() => {
  cleanup();
});
