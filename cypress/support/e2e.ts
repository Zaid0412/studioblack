import "@testing-library/cypress/add-commands";
import "./commands";

// Ignore Next.js hydration mismatch errors (theme script injection in dev mode).
// These are harmless and don't affect functionality.
Cypress.on("uncaught:exception", (err) => {
  if (err.message.includes("Hydration") || err.message.includes("hydration")) {
    return false;
  }
});
