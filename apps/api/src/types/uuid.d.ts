/**
 * Type declarations for uuid module.
 *
 * uuid v10 does not include built-in TypeScript types.
 * @see https://github.com/uuidjs/uuid
 */
declare module 'uuid' {
  export function v4(): string;
  export function v1(): string;
  export function v3(name: string, namespace: string): string;
  export function v5(name: string, namespace: string): string;
  export function v6(): string;
  export function v7(): string;
  export function validate(uuid: string): boolean;
  export function version(uuid: string): number;
  export function parse(uuid: string): Uint8Array;
  export function stringify(arr: Uint8Array): string;
}
