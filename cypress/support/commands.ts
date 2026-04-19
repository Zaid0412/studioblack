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
      // Wait for the login form to stabilize (splash screen + React hydration)
      cy.get("#email-address", { timeout: 15_000 }).should("be.visible");
      // Small wait for React to finish any re-renders after hydration
      cy.wait(1000);
      // Re-query the element after waiting to avoid detached DOM
      cy.get("#email-address").clear().type(email);
      cy.get("#password").clear().type(password);
      cy.contains("button", "Sign In").click();
      cy.url({ timeout: 60_000 }).should("include", "/dashboard");
    },
    {
      cacheAcrossSpecs: true,
      validate() {
        cy.request({
          url: "/api/auth/get-session",
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.eq(200);
          expect(res.body).to.have.property("user");
        });
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
