import { Component, createEffect, createMemo, createSignal, For, getOwner, Show } from "solid-js";

import logo from "./logo.svg";
import styles from "./App.module.css";
import "uno.css";

const [sharedCounter, setSharedCounter] = createSignal(0);

const Counter = () => {
  const [count, setCount] = createSignal(0, { name: "$count" });

  createEffect(
    () => {
      console.log(count());
    },
    undefined,
    { name: "EFFECT" }
  );

  return (
    <button class="btn" onclick={() => setCount(p => ++p)}>
      {count()}
    </button>
  );
};

const Wrapper: Component = props => {
  return <div class="wrapper-h">{props.children}</div>;
};

const ShowInfo: Component<{ shown: boolean }> = props => {
  const text = createMemo(
    () => (props.shown ? "Counter is Shown" : "Counter is Hidden"),
    undefined,
    { name: "_text-memo_" }
  );
  return <p>{text()}</p>;
};

const Dots: Component<{ n: number }> = props => {
  const dots = createMemo(() => new Array(props.n), undefined, { name: "dots" });
  return createMemo(
    () => (
      <div class="wrapper-h space-x-2">
        <For each={dots()}>{_ => <Counter></Counter>}</For>
      </div>
    ),
    undefined,
    { name: "render memo" }
  );
};

const App: Component = () => {
  const [show, setShow] = createSignal(true, { name: "$show" });

  return (
    <div class={styles.App}>
      <header class={styles.header}>
        <img src={logo} class={styles.logo} alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a onclick={() => setShow(p => !p)}>Toggle counter</a>
        <div class="my-4">
          <Show when={show()}>
            <Wrapper>
              <Counter />
              <button class="btn" onclick={() => setSharedCounter(p => ++p)}>
                {sharedCounter()}
              </button>
            </Wrapper>
          </Show>
          <p class="caption">{show() ? "show = true" : "show = false"}</p>
          <ShowInfo shown={show()} />
          <Dots n={sharedCounter()} />
        </div>
      </header>
    </div>
  );
};

export default App;
