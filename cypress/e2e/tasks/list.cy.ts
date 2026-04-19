describe("Tasks page", () => {
  beforeEach(() => {
    cy.loginAsPM();
    cy.visit("/tasks");
  });

  it("shows tasks page with heading", () => {
    cy.contains("Task Manager").should("be.visible");
  });

  it("has new task button", () => {
    cy.contains("button", "New Task").should("be.visible");
  });

  it("has search input", () => {
    cy.findByPlaceholderText("Search tasks...").should("be.visible");
  });
});
