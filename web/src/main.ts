import "./styles.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { installBrowserErrorReporting } from "./telemetry.ts";

installBrowserErrorReporting();
mount(App, { target: document.getElementById("app")! });
