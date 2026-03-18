import { Crown, Shield, User as UserIcon } from "lucide-react";

/** Returns the lucide icon element for a given organisation role. */
export function roleIcon(role: string) {
  if (role === "owner" || role === "pm")
    return <Crown className="w-3.5 h-3.5" />;
  if (role === "admin" || role === "architect")
    return <Shield className="w-3.5 h-3.5" />;
  return <UserIcon className="w-3.5 h-3.5" />;
}

/** Returns the translated display label for a given organisation role. */
export function roleLabel(role: string, t: (key: string) => string) {
  if (role === "owner") return t("roleOwner");
  if (role === "admin") return t("rolePM");
  if (role === "member") return t("roleArchitect");
  return role;
}
