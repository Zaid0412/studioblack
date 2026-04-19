import "@testing-library/cypress/add-commands";
import "./commands";

// Ignore harmless Next.js errors in dev mode:
// - Hydration mismatches from theme script injection
// - Syntax errors from hot-reload/compilation race conditions
Cypress.on("uncaught:exception", (err) => {
  if (
    err.message.includes("Hydration") ||
    err.message.includes("hydration") ||
    err.message.includes("Invalid or unexpected token") ||
    err.message.includes("Unexpected token")
  ) {
    return false;
  }
});
