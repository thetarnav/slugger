import type { Component } from "solid-js";

export type CreateContextProvider = <T, P extends Record<string, any>>(
  factoryFn: (props: P) => T
) => [provider: Component<P>, useContext: () => T | undefined];

export type CreateDefiniteContextProvider = <T, P extends Record<string, any>>(
  factoryFn: (props: P) => T
) => [provider: Component<P>, useContext: () => T];

export const definite = <T>(v: T) => v as NonNullable<T>;
