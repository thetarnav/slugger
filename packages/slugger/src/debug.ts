import { omit } from "@solid-primitives/immutable";
import { createSubRoot } from "@solid-primitives/rootless";
import { Fn, Get, includes, isFunction, forEachEntry } from "@solid-primitives/utils";
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
  createEffect,
  batch,
  on,
  $DEVCOMP
} from "solid-js";
import { createMutable, createStore, DeepReadonly } from "solid-js/store";
import type { Computation, Owner, SignalState } from "solid-js/types/reactive/signal";

let OWNER: Owner | null;

const getOwnerName = (owner: Owner): string => {
  const { name, componentName } = owner;
  let result = "";
  if (componentName)
    result += componentName.startsWith("_Hot$$") ? componentName.slice(6) : componentName;
  else if (name) result += name;
  return result || "(anonymous)";
};

const checkEqual = (a: any, b: any): boolean => a === b || (a.length === 0 && b.length === 0);

const isComponent = (o: Record<string, any>): boolean =>
  "componentName" in o && isFunction(o.value);

const getOwnerType = (o: Owner, parentType?: OwnerType): OwnerType => {
  if (o.name?.startsWith("sr-cl:") && !o.name.includes("-", 6)) return "refresh";
  if (isComponent(o)) return "component";
  if ("value" in o && "comparator" in o && o.pure === true) return "memo";
  if (o.user === true && o.pure === false) return "effect";
  if (
    o.pure === false &&
    o.fn + "" === "(current) => insertExpression(parent, accessor(), current, marker)" &&
    includes(["component", "refresh"], parentType)
  )
    return "render";
  return "computation";
};

const addCleanupFn = (o: Owner, fn: () => void) => {
  if (o.cleanups) o.cleanups.push(fn);
  else o.cleanups = [fn];
};
type State = SignalState<unknown> & { _value_listeners?: Set<Get<unknown>> };
type StateListener = Get<unknown>;
const addStateObserver = (state: State, fn: StateListener) => {
  if (state._value_listeners) return state._value_listeners.add(fn);
  state._value_listeners = new Set([fn]);
  let value = state.value;
  Object.defineProperty(state, "value", {
    get: () => value,
    set(a) {
      if (value !== a) {
        value = a;
        state._value_listeners!.forEach(fn => fn(a));
      }
    }
  });
};
const removeStateObserver = (state: State, fn: StateListener) => state._value_listeners?.delete(fn);

export type OwnerGraph = {
  ref: Owner;
  type: OwnerType;
  name: string;
  state: Record<string, Accessor<any>>;
  owned: Accessor<OwnerGraphChildren>;
  value?: Accessor<unknown>;
  dependencies: Accessor<OwnerDependencies>;
  dependents?: Accessor<OwnerDependents>;
};
export type OwnerGraphChildren = OwnerGraph[];
export type OwnerGraphValue = Accessor<unknown> | undefined;
export type OwnerGraphState = {
  value: Accessor<any>;
  setValue: Get<any>;
};
export type OwnerType = "memo" | "component" | "computation" | "effect" | "refresh" | "render";
export type OwnerDependencies = SignalState<unknown>[];
export type OwnerDependents = Computation<unknown>[];

const getChildrenGraph = (owner: Owner, parentType?: OwnerType): OwnerGraphChildren => {
  const initial: OwnerGraphChildren = [];
  owner.owned?.forEach(c => {
    const graph = mapOwnerTree(c, parentType);
    initial.push(graph);
  });
  return initial;
};

function mapChildren(
  owner: Owner & Computation<unknown> & SignalState<unknown>,
  parentType?: OwnerType
) {
  const onChange: Get<unknown>[] = [];
  let value: OwnerGraphValue;
  let dependents: Accessor<OwnerDependents> | undefined;

  const [children, setChildren] = createSignal<OwnerGraphChildren>(
    getChildrenGraph(owner, parentType),
    { equals: checkEqual }
  );
  const updateChildren = () => setChildren(getChildrenGraph(owner, parentType));
  onChange.push(updateChildren);

  if ("value" in owner) {
    if (isComponent(owner)) {
      value = owner.value;
    } else {
      const [v, setValue] = createSignal(owner.value);
      onChange.push(v => setValue(() => v));
      value = v;

      if ("observers" in owner) {
        const [d, setDependents] = createSignal<OwnerDependents>(owner.observers ?? []);
        onChange.push(() => queueMicrotask(() => setDependents(owner.observers ?? [])));
        dependents = d;
      }
    }
  }

  addStateObserver(owner, v => onChange.forEach(fn => fn(v)));

  return { children, value, dependents };
}

const trackDependencies = (owner: Owner & Computation<unknown>): Accessor<OwnerDependencies> => {
  const [dependencies, setDependencies] = createSignal<OwnerDependencies>([]);

  let runRequests = 0;
  const stateListener = () => {
    runRequests++;
    queueMicrotask(() => {
      if (--runRequests > 0) return;
      setDependencies(owner.sources ?? []);
      mapDependencies();
    });
  };

  let prevSources: State[] = [];
  const mapDependencies = () => {
    prevSources.forEach(s => removeStateObserver(s, stateListener));
    const sources = (prevSources = owner.sources ?? []);
    sources.forEach(s => addStateObserver(s, stateListener));
  };
  stateListener();

  return dependencies;
};

function mapOwnerTree(
  owner: Owner & Computation<unknown> & SignalState<unknown>,
  parentType?: OwnerType
): OwnerGraph {
  return createRoot(dispose => {
    addCleanupFn(owner, dispose);

    const name = getOwnerName(owner);
    const type = getOwnerType(owner, parentType);
    const sourceMap = owner.sourceMap ?? {};

    const { children, value, dependents } = mapChildren(owner, type);
    const dependencies = trackDependencies(owner);

    const node: OwnerGraph = {
      ref: owner,
      type,
      name,
      state: {},
      owned: children,
      value,
      dependencies,
      dependents
    };

    forEachEntry(sourceMap, (key, state) => {
      const [value, setValue] = createSignal(state.value);
      node.state[key] = value;
      addStateObserver(state, () => setValue(() => state.value));
    });

    return node;
  });
}

export const createOwnerGraph = (owner: Owner) => {
  OWNER = owner;

  return mapOwnerTree(owner);
};
