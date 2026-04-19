import "@testing-library/cypress/add-commands";
import "./commands";

// Ignore harmless Next.js errors:
// - Hydration mismatches from theme script injection (dev: "Hydration", prod: React error #418/#423)
// - Syntax errors from hot-reload/compilation race conditions
Cypress.on("uncaught:exception", (err) => {
  if (
    err.message.includes("Hydration") ||
    err.message.includes("hydration") ||
    err.message.includes("Minified React error #418") ||
    err.message.includes("Minified React error #423") ||
    err.message.includes("Invalid or unexpected token") ||
    err.message.includes("Unexpected token")
  ) {
    return false;
  }
});
