import {
  getOwner,
  JSX,
  createRoot,
  children,
  createMemo,
  Accessor,
  createSignal,
  Show,
  For,
  onMount,
  createEffect,
  getListener
} from "solid-js";
import { DeepReadonly } from "solid-js/store";
import { Portal } from "solid-js/web";
import { createOwnerGraph, OwnerGraph, OwnerGraphChildren, OwnerGraphValue } from "./debug";
import { animate } from "motion";
import { pointerHover } from "@solid-primitives/pointer";
import { createContextProvider } from "./providerFactory";
import { isArray, withFallback, isFunction, access } from "@solid-primitives/utils";
// place this in code to avoid being tree-shaken
pointerHover;

type HighlightRect = { t: number; l: number; w: number; h: number };

const [DebuggerProvider, _useDebuggerState] = createContextProvider(() => {
  const [highlightElement, setHighlightElement] = createSignal<Accessor<Element> | null>(null);

  return {
    highlightElement,
    setHighlightElement
  };
});
const useDebuggerState = () =>
  withFallback(_useDebuggerState(), {
    highlightElement: () => null,
    setHighlightElement: () => null
  });

const ElementHighlighter = () => {
  const { highlightElement } = useDebuggerState();

  const highlightRect = createMemo<HighlightRect>(() => {
    const el = highlightElement()?.();
    if (!el) return { t: 0, l: 0, w: 0, h: 0 };
    const bounds = el.getBoundingClientRect();
    return {
      t: bounds.top,
      l: bounds.left,
      w: bounds.width,
      h: bounds.height
    };
  });

  return (
    <Portal>
      <div
        style={{
          opacity: highlightElement() ? 1 : 0,
          transform: `translate(${highlightRect().l}px, ${highlightRect().t}px)`,
          width: `${highlightRect().w}px`,
          height: `${highlightRect().h}px`
        }}
        class="fixed pointer-events-none -top-2 -left-2 p-2 bg-yellow-400/40 rounded-lg"
      ></div>
    </Portal>
  );
};

const flashOnChange = (dep: Accessor<any>, el: () => Element) => {
  onMount(() => {
    const animation = animate(el(), { background: ["#0284c7", "none"] }, { duration: 0.5 });
    createEffect(() => {
      dep();
      animation.cancel();
      animation.play();
    });
  });
};

// const Dependencies = (props: )

const DependencyCount = (props: {
  n: number;
  type: "dependents" | "dependencies";
}): JSX.Element => {
  const a = createMemo(() => new Array(Math.ceil(props.n / 2)));
  const b = createMemo(() => new Array(Math.floor(props.n / 2)));
  const color = props.type === "dependents" ? "56, 189, 248" : "253, 224, 71";

  const dot = () => (
    <div class="w-1 h-1 rounded-full" style={{ background: `rgba(${color})` }}></div>
  );

  return (
    <Show when={props.n}>
      <div class="flex mt-0.5">
        <div
          class="max-h-3 min-h-2 w-max py-0.5 px-1 rounded space-y-1 flex flex-col justify-center"
          style={{ background: `rgba(${color}, 0.1)` }}
        >
          <div class="flex space-x-1">
            <For each={a()}>{dot}</For>
          </div>
          <Show when={b().length}>
            <div class="flex space-x-1">
              <For each={b()}>{dot}</For>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
};

const StateNode = (props: { name: string; value: any }) => {
  let ref!: HTMLElement;
  flashOnChange(
    () => props.value,
    () => ref
  );

  return (
    <div>
      <span class="relative">
        <span ref={e => (ref = e)} class="absolute -inset-0.7 bg-red-500 rounded"></span>
        <span class="relative z-1">
          {props.name}: <strong>{props.value + ""}</strong>
        </span>
      </span>
    </div>
  );
};

const ElementValueNode = (props: { value: Element }) => {
  const { setHighlightElement } = useDebuggerState();

  const handleHover = (isHovering: boolean) => {
    setHighlightElement(p =>
      isHovering ? () => props.value : p && p() !== props.value ? p : null
    );
  };
  return (
    <strong use:pointerHover={handleHover}>{`<${props.value.tagName.toLowerCase()}/>`}</strong>
  );
};

const ValueNode = (props: { value: OwnerGraphValue }) => {
  const display = createMemo(() => props.value && props.value() !== undefined);

  const value = createMemo(() => {
    if (!display()) return undefined;
    const v = (props.value as any)();
    if (v instanceof Element) return <ElementValueNode value={v} />;
    if (isArray(v)) return <strong>Array ({v.length})</strong>;
    return <strong>{v + ""}</strong>;
  });

  return (
    <Show when={display()}>
      {() => {
        let ref!: HTMLElement;
        flashOnChange(value, () => ref);

        return (
          <div>
            <span class="relative">
              <span ref={e => (ref = e)} class="absolute -inset-0.7 bg-red-500 rounded"></span>
              <span class="relative z-1 opacity-60">{value()}</span>
            </span>
          </div>
        );
      }}
    </Show>
  );
};

function OwnerNode(props: { owner: OwnerGraph }) {
  const { type, owned, state, name, dependencies, dependents } = props.owner;

  let children = owned;
  let stateMap = state;
  let value = props.owner.value;

  const handleSpecialNodes = () => {
    if (type === "render") {
      value = () => access(props.owner.value?.());
      return;
    }
    if (type === "component") {
      // <Show> component
      if (name === "Show") {
        const condition = owned().find(o => !isFunction(o.value?.()))!;
        const renderer = owned().find(o => isFunction(o.value?.()))!;
        children = () => renderer.owned();
        stateMap = {};
        value = condition.value;
        return;
      }
      // has solid-refresh memo
      const refresh = owned().find(o => o.type === "refresh");
      if (refresh) {
        children = refresh.owned;
        stateMap = refresh.state;
        return;
      }
    }
  };
  handleSpecialNodes();
  const stateEntries = Object.entries(stateMap);

  let ref!: HTMLElement;
  onMount(() => {
    animate(ref, { backgroundColor: ["#0284c7", "none"] }, { duration: 0.5 });
  });

  return (
    <div
      ref={e => (ref = e)}
      class="bg-cyan-200/10 border-0 border-t-1px border-l-1px border-cyan-900/30 outline-1px caption text-12px pt-1 pl-0.5"
    >
      <div class="pb-1 pr-2">
        <p class="italic pb-0.5">
          {name} <span class="text-10px opacity-40">{type}</span>
        </p>
        <ValueNode value={value} />
        <div class="flex space-x-1">
          <DependencyCount n={dependencies().length} type="dependencies" />
          <Show when={dependents}>{d => <DependencyCount n={d().length} type="dependents" />}</Show>
        </div>
      </div>
      <Show when={stateEntries.length}>
        <div>
          <For each={stateEntries}>
            {([name, value]) => <StateNode name={name} value={value()} />}
          </For>
        </div>
      </Show>
      <Show when={children().length}>
        <div class="pl-4 pt-1">
          <For each={children()}>{o => <OwnerNode owner={o} />}</For>
        </div>
      </Show>
    </div>
  );
}

export function Debugger(props: { children: JSX.Element }): JSX.Element {
  const [graph, resolved] = createRoot(dispose => {
    const resolved = children(() => props.children);
    const owner = getOwner();
    const [graph, setGraph] = createSignal(owner ? createOwnerGraph(owner) : undefined);
    return [graph, resolved];
  });

  return (
    <div
      class="grid w-screen h-screen overflow-hidden"
      style={{
        "grid-template-columns": "35% 65%"
      }}
    >
      <DebuggerProvider>
        <ElementHighlighter />
        <div class="p-2 overflow-auto">
          <div
            class="cursor-default border-0 border-b-1px border-r-1px border-cyan-900/30"
            style={{
              width: "max-content"
            }}
          >
            <Show when={graph()}>
              {graph => <For each={graph.owned()}>{o => <OwnerNode owner={o} />}</For>}
            </Show>
          </div>
        </div>
      </DebuggerProvider>
      <div>{resolved()}</div>
    </div>
  );
}
