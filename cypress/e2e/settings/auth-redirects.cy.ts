describe("Auth pages redirect authenticated users", () => {
  beforeEach(() => {
    cy.loginAsPM();
  });

  it("login page redirects to dashboard when already authenticated", () => {
    cy.visit("/login");
    cy.url().should("include", "/dashboard", { timeout: 10_000 });
  });

  it("register page redirects to dashboard when already authenticated", () => {
    cy.visit("/register");
    cy.url().should("include", "/dashboard", { timeout: 10_000 });
  });
});
