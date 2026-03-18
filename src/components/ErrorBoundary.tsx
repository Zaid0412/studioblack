"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** React error boundary that catches render errors and shows a fallback UI. */
export class ErrorBoundary extends Component<Props, State> {
  /** Initialise error boundary state. */
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /** Derive error state from a caught render error. */
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /** Log the error and component stack to the console. */
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  /** Render fallback UI on error or children when healthy. */
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-16 px-4">
          <AlertTriangle className="w-10 h-10 text-orange-500" />
          <h2 className="text-lg font-semibold text-text-primary">
            Something went wrong
          </h2>
          <p className="text-sm text-text-muted text-center max-w-md">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
