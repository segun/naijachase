// Development-only review harness; no gameplay API calls or production entry.
import "../src/styles.css";
import { mount } from "svelte";
import AdReview from "./AdReview.svelte";
mount(AdReview,{target:document.getElementById("app")!});
