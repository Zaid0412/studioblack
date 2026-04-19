/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      /** Log in via the UI and cache the session. */
      login(email: string, password: string): Chainable<void>;
      /** Log in as the PM test user (cached session). */
      loginAsPM(): Chainable<void>;
      /** Log in as the Architect test user (cached session). */
      loginAsArchitect(): Chainable<void>;
    }
  }
}

Cypress.Commands.add("login", (email: string, password: string) => {
  cy.session(
    email,
    () => {
      cy.visit("/login");
      cy.get("#email-address").type(email);
      cy.get("#password").type(password);
      cy.contains("button", "Sign In").click();
      cy.url().should("include", "/dashboard", { timeout: 30_000 });
    },
    {
      cacheAcrossSpecs: true,
      validate() {
        cy.visit("/dashboard");
        cy.url().should("include", "/dashboard", { timeout: 15_000 });
      },
    }
  );
});

Cypress.Commands.add("loginAsPM", () => {
  cy.fixture("users.json").then((users) => {
    cy.login(users.pm.email, users.pm.password);
  });
});

Cypress.Commands.add("loginAsArchitect", () => {
  cy.fixture("users.json").then((users) => {
    cy.login(users.architect.email, users.architect.password);
  });
});

export {};
