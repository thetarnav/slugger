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
  onMount,
  Component,
  createEffect
} from "solid-js";
import { createMutable, createStore, DeepReadonly } from "solid-js/store";
import { createOwnerGraph, OwnerGraph, OwnerGraphValue } from "./debug";
import { animate } from "motion";

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

const ValueNode = (props: { value: OwnerGraphValue }) => {
  const display = createMemo(() => props.value && props.value() !== undefined);
  const value = createMemo(() => {
    if (!display()) return;
    const v = (props.value as any)();
    if (v instanceof Element) return `<${v.tagName.toLowerCase()}/>`;
    return v;
  });

  return (
    <Show when={display()}>
      {() => {
        let ref!: HTMLElement;
        flashOnChange(value, () => ref);

        return (
          <div class="mb-1">
            <span class="relative">
              <span ref={e => (ref = e)} class="absolute -inset-0.7 bg-red-500 rounded"></span>
              <span class="relative z-1 text-gray-600">
                <strong>{value() + ""}</strong>
              </span>
            </span>
          </div>
        );
      }}
    </Show>
  );
};

function OwnerNode(props: { owner: DeepReadonly<OwnerGraph> }) {
  const children = createMemo(() => props.owner.children());
  const stateEntries = createMemo(() => Object.entries(props.owner.state));

  let ref!: HTMLElement;
  onMount(() => {
    animate(ref, { backgroundColor: ["#0284c7", "none"] }, { duration: 0.5 });
  });

  return (
    <div
      ref={e => (ref = e)}
      class="bg-cyan-200/10 outline outline-cyan-900/30 caption text-12px pt-1"
    >
      <p>
        <i>{props.owner.name}</i>
      </p>
      <ValueNode value={props.owner.value} />
      <Show when={stateEntries().length}>
        <div>
          <For each={stateEntries()}>
            {([name, value]) => <StateNode name={name} value={value()} />}
          </For>
        </div>
      </Show>
      <div class="pl-4 pt-1">
        <For each={children()}>{o => <OwnerNode owner={o} />}</For>
      </div>
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
        "grid-template-columns": "40% 60%"
      }}
    >
      <div class="p-2 overflow-auto">
        <div
          class=""
          style={{
            width: "max-content"
          }}
        >
          <Show when={graph()}>{graph => <OwnerNode owner={graph} />}</Show>
        </div>
      </div>
      <div>{resolved()}</div>
    </div>
  );
}
