describe("Logout", () => {
  beforeEach(() => {
    cy.loginAsPM();
  });

  it("logs out and redirects to login", () => {
    cy.visit("/dashboard");
    cy.url().should("include", "/dashboard");

    // Open user popover — the trigger is a button at the bottom of the sidebar aside
    cy.get("aside").should("be.visible");
    cy.get("aside").find("button").last().click();

    // Click "Log Out" in the popover
    cy.contains("button", "Log Out").should("be.visible").click();

    cy.url().should("include", "/login", { timeout: 15_000 });
  });
});
