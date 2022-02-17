import { omit } from "@solid-primitives/immutable";
import { createSubRoot } from "@solid-primitives/rootless";
import { Fn, Get, isFunction } from "@solid-primitives/utils";
import {
  getOwner,
  JSX,
  createRoot,
  DEV,
  children,
  createMemo,
  Accessor,
  createSignal,
  Show,
  For,
  createComputation,
  runComputation,
  updateComputation,
  runWithOwner,
  batch
} from "solid-js";
import { createMutable, createStore, DeepReadonly } from "solid-js/store";
import type { Computation, Owner, SignalState } from "solid-js/types/reactive/signal";
import { Portal } from "solid-js/web";

const serializeGraph = DEV.serializeGraph;

let OWNER: Owner | null;

const getComponentName = (owner: Owner): string => {
  const { name, componentName } = owner;
  let result = "";
  if (componentName)
    result += `<${componentName.startsWith("_Hot$$") ? componentName.slice(6) : componentName}/>`;
  else if (name) result += name;
  return result || "(anonymous)";
};

const isComponent = (owner: Record<string, any>): boolean =>
  "componentName" in owner && typeof owner.value === "function";

const addCleanupFn = (o: Owner, fn: () => void) => {
  if (o.cleanups) o.cleanups.push(fn);
  else o.cleanups = [fn];
};
const addStateObserver = (state: SignalState<unknown>, fn: Get<unknown>) => {
  let value = state.value;
  Object.defineProperty(state, "value", {
    get: () => value,
    set: a => {
      if (value !== a) (value = a), fn(a);
    }
  });
};

export type OwnerGraph = {
  name: string;
  state: Record<string, Accessor<any>>;
  children: Accessor<OwnerGraphChildren>;
  value?: Accessor<unknown>;
};
export type OwnerGraphChildren = OwnerGraph[];
export type OwnerGraphValue = Accessor<unknown> | undefined;

const getChildrenGraph = (owner: Owner): OwnerGraphChildren => {
  const initial: OwnerGraphChildren = [];
  owner.owned?.forEach(c => {
    const graph = mapOwnerTree(c);
    initial.push(graph);
  });
  return initial;
};

function mapChildren(owner: Owner): [Accessor<OwnerGraphChildren>, OwnerGraphValue] {
  let onChange: Get<unknown>;
  let value: OwnerGraphValue;

  const [children, setChildren] = createSignal<OwnerGraphChildren>(getChildrenGraph(owner), {
    equals: (a, b) => a === b || (a.length === 0 && b.length === 0)
  });

  const parseValue = (v: unknown) => (isFunction(v) ? undefined : v);

  if (!isComponent(owner) && "value" in owner) {
    const [v, setValue] = createSignal(parseValue(owner.value));
    onChange = v =>
      batch(() => {
        setChildren(getChildrenGraph(owner));
        setValue(parseValue(v));
      });
    value = v;
  } else {
    onChange = () => setChildren(getChildrenGraph(owner));
  }
  addStateObserver(owner, onChange);

  return [children, value];
}

function mapOwnerTree(start: Owner): OwnerGraph {
  return createRoot(dispose => {
    const name = getComponentName(start);
    const { owned, sourceMap } = start;

    addCleanupFn(start, dispose);
    const [children, value] = mapChildren(start);

    const node: OwnerGraph = {
      name,
      state: {},
      children,
      value
    };

    // TODO: dom elements
    // if (start.componentName && start.fn) {
    //   console.log(getComponentName(start), start.fn()?.());
    // console.log(start.value());
    // }

    if (sourceMap)
      Object.entries(sourceMap).forEach(([key, state]) => {
        const [value, setValue] = createSignal(state.value);
        node.state[key] = value;
        addStateObserver(state, () => setValue(() => state.value));
      });

    return node;
  });
}

export const createOwnerGraph = (owner: Owner) => {
  OWNER = owner;

  const ownerTree: { root: OwnerGraph | undefined } = createMutable<{
    root: OwnerGraph | undefined;
  }>({
    root: mapOwnerTree(owner)
  });

  return ownerTree.root;
};
