describe("Task CRUD", () => {
  beforeEach(() => {
    cy.loginAsPM();
  });

  const testTaskTitle = `E2E Task ${Date.now()}`;
  const updatedTitle = `${testTaskTitle} Updated`;

  it("creates a task, views detail, edits, and deletes", () => {
    cy.visit("/tasks");

    // ── Create ──
    cy.intercept("POST", "/api/tasks").as("createTask");
    cy.contains("button", "New Task").click();
    cy.get("[role='dialog']").should("be.visible");
    cy.get("[role='dialog']")
      .find("input[placeholder='Task title']")
      .type(testTaskTitle);
    cy.get("[role='dialog']").contains("button", "Create Task").click();
    cy.wait("@createTask");
    cy.get("[role='dialog']", { timeout: 15_000 }).should("not.exist");

    // Task should appear in the list
    cy.get("[data-task-id]", { timeout: 10_000 }).should("have.length.gte", 1);

    // ── View detail ──
    cy.get("[data-task-id]").first().find(".lg\\:flex").first().click();
    cy.get("[role='dialog']").should("be.visible");
    cy.get("[role='dialog']").contains(testTaskTitle).should("exist");
    cy.get("[role='dialog']").contains("Medium").should("exist");

    // ── Edit via detail modal ──
    cy.get("[role='dialog']").contains("button", "Edit").click();
    cy.get("[role='dialog']")
      .find("input[placeholder='Task title']", { timeout: 10_000 })
      .should("be.visible");

    cy.intercept("PATCH", "/api/tasks/*").as("updateTask");
    cy.get("[role='dialog']")
      .find("input[placeholder='Task title']")
      .clear()
      .type(updatedTitle);
    cy.get("[role='dialog']").contains("button", "Save Changes").click();
    cy.wait("@updateTask");
    cy.get("[role='dialog']", { timeout: 15_000 }).should("not.exist");

    // ── Toggle status via detail modal ──
    cy.get("[data-task-id]", { timeout: 10_000 })
      .first()
      .find(".lg\\:flex")
      .first()
      .click();
    cy.get("[role='dialog']").should("be.visible");
    cy.get("[role='dialog']").contains(updatedTitle).should("exist");
    cy.get("[role='dialog']").contains("To Do").should("exist");

    cy.intercept("PATCH", "/api/tasks/*").as("toggleStatus");
    cy.get("[role='dialog']").contains("button", "Complete").click();
    cy.wait("@toggleStatus");
    cy.get("[role='dialog']", { timeout: 15_000 }).should("not.exist");

    // ── Delete via detail modal ──
    cy.get("[data-task-id]", { timeout: 10_000 })
      .first()
      .find(".lg\\:flex")
      .first()
      .click();
    cy.get("[role='dialog']").should("be.visible");

    // The danger/delete button is the only button with "error" in its classes
    cy.get("[role='dialog']").find("button[class*='error']").click();

    // Delete confirmation dialog replaces the detail modal
    cy.intercept("DELETE", "/api/tasks/*").as("deleteTask");
    cy.get("[role='dialog']").should("be.visible");
    cy.get("[role='dialog']")
      .contains("button", "Delete")
      .click({ force: true });
    cy.wait("@deleteTask");
    cy.get("[role='dialog']", { timeout: 15_000 }).should("not.exist");
    // Verify the deleted task no longer appears in the list
    cy.contains(updatedTitle).should("not.exist");
  });
});
