describe("Register", () => {
  beforeEach(() => {
    cy.visit("/register");
  });

  it("shows registration form with all fields", () => {
    cy.get("#full-name").should("be.visible");
    cy.get("#email-address").should("be.visible");
    cy.get("#password").should("be.visible");
    cy.get("#confirm-password").should("be.visible");
    cy.contains("button", "Create Account").should("be.visible");
  });

  it("shows error when passwords do not match", () => {
    cy.get("#full-name").type("Test User");
    cy.get("#email-address").type("test-mismatch@test.studioblack.com");
    cy.get("#password").type("TestPassword123!");
    cy.get("#confirm-password").type("DifferentPassword!");
    cy.contains("button", "Create Account").click();

    cy.findByRole("alert").should("contain.text", "do not match");
  });

  it("has link to login page", () => {
    cy.contains("a", "Sign in").click();
    cy.url().should("include", "/login");
  });
});
