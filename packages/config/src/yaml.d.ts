/**
 * Fallback typings for the `yaml` package.
 *
 * yaml@2.6.1 ships Node types at dist/index.d.ts (exports.types). With
 * moduleResolution "NodeNext" and customConditions ["node"], TypeScript uses
 * those when dist/ is present. If dist/ was removed (e.g. by deleting every
 * dist/ directory under the repo), these declarations keep tsc buildable until
 * postinstall restores the package.
 */
declare module 'yaml' {
  export interface ParseOptions {
    intAsBigInt?: boolean;
    prettyErrors?: boolean;
    strict?: boolean;
    uniqueKeys?: boolean;
  }

  export interface StringifyOptions {
    indent?: number;
    lineWidth?: number;
    minContentWidth?: number;
  }

  export function parse(source: string, options?: ParseOptions): unknown;
  export function stringify(value: unknown, options?: StringifyOptions): string;
}
