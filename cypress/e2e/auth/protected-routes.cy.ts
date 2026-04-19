describe("Protected routes redirect to login", () => {
  const routes = [
    "/dashboard",
    "/projects",
    "/tasks",
    "/settings",
    "/organisation",
  ];

  for (const route of routes) {
    it(`${route} redirects unauthenticated users to /login`, () => {
      cy.visit(route);
      cy.url().should("include", "/login");
    });
  }
});
