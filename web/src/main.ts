import "./styles.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { installBrowserErrorReporting, installPerformanceReporting } from "./telemetry.ts";
import { captureInstallPrompt } from "./ui/install-prompt.ts";
import { installUsageReporting } from "./usage.ts";

captureInstallPrompt();
installBrowserErrorReporting();
installPerformanceReporting();
installUsageReporting();
mount(App, { target: document.getElementById("app")! });
// The privacy control is independent of first paint. Loading it as its own
// component chunk keeps its JS and CSS out of the startup bundle while still
// presenting the choice immediately after the application mounts.
void import("./ui/UsagePrivacy.svelte").then(({ default: UsagePrivacy }) => {
  mount(UsagePrivacy, { target: document.body.appendChild(document.createElement("div")) });
});
