describe("Settings page", () => {
  beforeEach(() => {
    cy.loginAsPM();
    cy.visit("/settings");
  });

  it("shows settings page with heading", () => {
    cy.contains("User Settings").should("be.visible");
  });

  it("displays profile section with name field", () => {
    cy.contains("Profile").should("be.visible");
    cy.get("#full-name").should("be.visible");
  });

  it("allows updating profile name", () => {
    cy.get("#full-name").should("be.visible").invoke("val").as("originalName");

    cy.get("#full-name").clear().type("E2E Updated Name");
    cy.contains("button", "Save Profile").click();

    // Wait for save to complete
    cy.contains("button", "Save Profile").should("not.be.disabled");

    // Restore original name
    cy.get<string>("@originalName").then((name) => {
      cy.get("#full-name").clear().type(name);
      cy.contains("button", "Save Profile").click();
    });
  });

  it("shows password section", () => {
    cy.contains("Change Password").should("be.visible");
  });
});
