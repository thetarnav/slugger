/* @refresh reload */
import { render } from "solid-js/web";

import "./index.css";
import App from "./App";
import { Debugger } from "./Debugger";

render(
  () => (
    <Debugger>
      <App />
    </Debugger>
  ),
  document.getElementById("root") as HTMLElement
);
