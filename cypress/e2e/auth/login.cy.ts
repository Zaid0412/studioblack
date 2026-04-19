describe("Login", () => {
  beforeEach(() => {
    cy.visit("/login");
  });

  it("shows login form with email and password fields", () => {
    cy.get("#email-address").should("be.visible");
    cy.get("#password").should("be.visible");
    cy.contains("button", "Sign In").should("be.visible");
  });

  it("shows error on invalid credentials", () => {
    cy.get("#email-address").type("nonexistent@test.com");
    cy.get("#password").type("wrongpassword");
    cy.contains("button", "Sign In").click();

    cy.findByRole("alert").should("be.visible");
  });

  it("stays on login page when submitting empty form", () => {
    cy.contains("button", "Sign In").click();
    cy.url().should("include", "/login");
  });

  it("redirects to dashboard on successful login", () => {
    cy.fixture("users.json").then((users) => {
      cy.get("#email-address").type(users.pm.email);
      cy.get("#password").type(users.pm.password);
      cy.contains("button", "Sign In").click();

      cy.url().should("include", "/dashboard", { timeout: 30_000 });
    });
  });

  it("has link to register page", () => {
    cy.contains("a", "Sign up").click();
    cy.url().should("include", "/register");
  });
});
