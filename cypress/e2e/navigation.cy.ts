describe("Sidebar navigation", () => {
  beforeEach(() => {
    cy.loginAsPM();
  });

  const navItems = [
    { label: "Dashboard", url: "/dashboard" },
    { label: "Projects", url: "/projects" },
    { label: "Tasks", url: "/tasks" },
    { label: "Settings", url: "/settings" },
  ];

  for (const item of navItems) {
    it(`navigates to ${item.url}`, () => {
      cy.visit("/dashboard");
      cy.get("nav").contains("a", item.label).click();
      cy.url().should("include", item.url);
    });
  }
});
