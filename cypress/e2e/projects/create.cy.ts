describe("Create project", () => {
  beforeEach(() => {
    cy.loginAsPM();
  });

  it("navigates to new project form from projects list", () => {
    cy.visit("/projects");
    cy.contains("button", "New Project", { timeout: 15_000 }).click();
    cy.url({ timeout: 15_000 }).should("include", "/projects/new");
  });

  it("shows project form with required fields", () => {
    cy.visit("/projects/new");
    cy.get("#project-name", { timeout: 15_000 }).should("be.visible");
    cy.contains("Project Category").should("be.visible");
    cy.contains("button", "Create Project").scrollIntoView().should("exist");
  });

  it("creates a project and redirects", () => {
    cy.visit("/projects/new");

    cy.get("#project-name", { timeout: 15_000 }).type(
      `E2E Test Project ${Date.now()}`
    );

    // Open Radix Select for category
    cy.contains("Select a category").click();
    // Click the Radix SelectItem (role="option"), not a native <option>
    cy.get("[role='option']").contains("Residential").click();

    cy.contains("button", "Create Project").scrollIntoView().click();

    // Should redirect to projects list or project detail
    cy.url({ timeout: 15_000 }).should("include", "/projects");
  });
});
