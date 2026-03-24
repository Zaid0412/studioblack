"use client";

import { useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RefreshButtonProps {
  onRefresh: () => void | Promise<void>;
  tooltip?: string;
}

/** Icon button with tooltip that spins while refreshing. */
export function RefreshButton({
  onRefresh,
  tooltip = "Refresh",
}: RefreshButtonProps) {
  const [spinning, setSpinning] = useState(false);

  const handleClick = useCallback(async () => {
    setSpinning(true);
    try {
      await onRefresh();
    } finally {
      setSpinning(false);
    }
  }, [onRefresh]);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            disabled={spinning}
            className="p-2 rounded-md text-[#666666] hover:text-white hover:bg-[#2A2A2A] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
