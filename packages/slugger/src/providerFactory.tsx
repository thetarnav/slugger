import { Component, createContext, useContext } from "solid-js";
import type { CreateContextProvider, CreateDefiniteContextProvider } from "./providerFactoryTypes";

export const createContextProvider: CreateContextProvider = factoryFn => {
  const ctx = createContext<any>();
  const Provider: Component<any> = props => {
    const state = factoryFn(props);
    return <ctx.Provider value={state}>{props.children}</ctx.Provider>;
  };
  const useProvider = () => useContext(ctx);
  return [Provider, useProvider];
};

export const createDefiniteContextProvider = createContextProvider as CreateDefiniteContextProvider;
