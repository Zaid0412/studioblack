describe("Projects list", () => {
  beforeEach(() => {
    cy.loginAsPM();
    cy.visit("/projects");
  });

  it("shows projects page with heading", () => {
    cy.contains("h1, h2", "All Projects").should("be.visible");
  });

  it("shows New Project button for PM role", () => {
    cy.contains("a, button", "New Project").should("be.visible");
  });

  it("has search input", () => {
    cy.findByPlaceholderText("Search projects...").should("be.visible");
  });

  it("has filter/sort controls", () => {
    cy.contains("All Status").should("be.visible");
  });
});
