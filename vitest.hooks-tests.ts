/**
 * Single source of truth for the React hook/component test files.
 *
 * These need a DOM, so they belong to the `dom` (jsdom) project in
 * `vitest.config.ts`. The `node` project globs all of `src/test/**` and
 * excludes exactly this list — sharing one array is what stops the two from
 * drifting and running these files twice.
 *
 * Add a new DOM test here, or it will run in the node environment.
 */
export const HOOK_TEST_FILES = [
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
  "src/test/unit/CategoryForm.test.tsx",
  "src/test/unit/SearchableDropdown.test.tsx",
  "src/test/unit/BoqEditableCell.test.tsx",
  "src/test/unit/FilePreview.test.tsx",
  "src/test/unit/UploadDocumentDialog.test.tsx",
  "src/test/unit/DocumentBulkActions.test.tsx",
  "src/test/unit/DocumentVersionList.test.tsx",
  "src/test/unit/SectionSidebar.test.tsx",
  "src/test/unit/MobileSectionAccordion.test.tsx",
  "src/test/unit/useLongPress.test.tsx",
  "src/test/unit/useDismissOnEscape.test.tsx",
  "src/test/unit/MobileBottomNav.test.tsx",
];
