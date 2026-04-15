"use client";

import { useState } from "react";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { authClient } from "@/lib/authClient";

interface GoogleSignInButtonProps {
  callbackURL: string;
  disabled?: boolean;
}

/** Google OAuth sign-in button — shared between login and register pages. */
export function GoogleSignInButton({
  callbackURL,
  disabled,
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        setIsLoading(true);
        await authClient.signIn.social({
          provider: "google",
          callbackURL,
        });
      }}
      disabled={isLoading || disabled}
      className="w-full flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-medium border border-border-default rounded-lg hover:bg-bg-secondary transition-colors disabled:opacity-50 cursor-pointer"
    >
      <GoogleIcon className="w-5 h-5" />
      <span className="text-text-primary">Continue with Google</span>
    </button>
  );
}
