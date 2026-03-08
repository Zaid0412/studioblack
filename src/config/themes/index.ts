export interface Theme {
  name: string;
  colors: Record<string, string>;
  font?: {
    sans: string;
  };
}

export { default as defaultTheme } from "./default";
