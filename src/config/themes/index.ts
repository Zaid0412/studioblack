export interface Theme {
  name: string;
  colors: Record<string, string>;
}

export { default as defaultTheme } from "./default";
