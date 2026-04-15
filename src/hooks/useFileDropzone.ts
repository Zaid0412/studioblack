import { useCallback, useState } from "react";

/**
 * Shared drag-and-drop handler for file drop zones.
 * Accepts an `addFiles` callback and returns the drag state + event handlers.
 */
export function useFileDropzone(addFiles: (files: FileList) => void) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  return { dragOver, handleDrop, handleDragOver, handleDragLeave };
}
