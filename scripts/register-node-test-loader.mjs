import { register } from "node:module";

register(new URL("./node-test-loader.mjs", import.meta.url), import.meta.url);