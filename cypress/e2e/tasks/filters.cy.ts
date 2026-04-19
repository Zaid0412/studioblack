describe("Task filters and buckets", () => {
  beforeEach(() => {
    cy.loginAsPM();
    cy.visit("/tasks");
    // Wait for task list to load
    cy.get("[data-task-id]", { timeout: 15_000 }).should("exist");
  });

  it("filters tasks by search", () => {
    cy.findByPlaceholderText("Search tasks...").type("nonexistent-xyz-12345");
    // Debounce is 300ms + API call; allow generous time
    cy.contains("No tasks found", { timeout: 10_000 }).should("be.visible");
  });

  it("filters tasks by status", () => {
    cy.contains("All Status").click();
    cy.get("[role='option']").contains("Completed").click();
    cy.url().should("include", "status=completed");
  });

  it("filters tasks by priority", () => {
    cy.contains("All Priority").click();
    cy.get("[role='option']").contains("High").click();
    cy.url().should("include", "priority=high");
  });

  it("filters tasks by category", () => {
    cy.contains("All Category").click();
    cy.get("[role='option']").contains("Design").click();
    cy.url().should("include", "category=design");
  });

  it("switches between buckets", () => {
    // Desktop sidebar is inside an <aside> with hidden lg:block
    cy.get("aside").contains("button", "My Tasks").click();
    cy.url().should("include", "bucket=my_tasks");

    cy.get("aside").contains("button", "Starred").click();
    cy.url().should("include", "bucket=starred");

    cy.get("aside").contains("button", "All").click();
    cy.url().should("not.include", "bucket=");
  });
});
