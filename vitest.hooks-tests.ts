/**
 * Single source of truth for the React hook/component test files.
 *
 * These need a DOM, so they run under `vitest.config.hooks.ts` (jsdom). The
 * main `vitest.config.ts` (node env) globs all of `src/test/**` and must
 * exclude exactly this list — otherwise these files run under BOTH configs,
 * which double-executes them and double-counts the totals.
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
