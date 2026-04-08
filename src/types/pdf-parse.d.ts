declare module "pdf-parse";

declare module "pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js" {
  export const VerbosityLevel: {
    ERRORS: number;
    WARNINGS: number;
    INFOS: number;
  };

  export function setVerbosityLevel(level: number): void;
}
