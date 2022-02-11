import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/codemirror-lambda-calculus" : "",
}));
