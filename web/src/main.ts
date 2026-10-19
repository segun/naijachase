import "./styles.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { installBrowserErrorReporting, installPerformanceReporting } from "./telemetry.ts";
import { captureInstallPrompt } from "./ui/install-prompt.ts";

captureInstallPrompt();
installBrowserErrorReporting();
installPerformanceReporting();
mount(App, { target: document.getElementById("app")! });
