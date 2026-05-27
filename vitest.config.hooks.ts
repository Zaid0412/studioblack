import { defineConfig } from "vitest/config";
import path from "path";

/** Separate config for React hook tests (jsdom environment, no global setup). */
export default defineConfig({
  test: {
    include: [
      "src/test/unit/hooks.test.tsx",
      "src/test/unit/hooks-complex.test.tsx",
      "src/test/unit/hooks-upload-toast.test.tsx",
      "src/test/unit/hooks-batch-upload.test.tsx",
      "src/test/unit/hooks-tasks.test.tsx",
      "src/test/unit/hooks-project-review.test.tsx",
      "src/test/unit/hooks-settings-org.test.tsx",
      "src/test/unit/hooks-contexts.test.tsx",
      "src/test/unit/hooks-ui-components.test.tsx",
      "src/test/unit/TagInput.test.tsx",
      "src/test/unit/SearchableDropdown.test.tsx",
      "src/test/unit/BoqEditableCell.test.tsx",
      "src/test/unit/FilePreview.test.tsx",
      "src/test/unit/UploadDocumentDialog.test.tsx",
      "src/test/unit/DocumentBulkActions.test.tsx",
    ],
    environment: "jsdom",
    restoreMocks: true,
    env: {
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
