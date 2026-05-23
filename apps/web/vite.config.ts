import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { loadEnv } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(webDir, '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '');

  Object.assign(process.env, env);

  return {
    plugins: [sveltekit()],
    envDir: repoRoot,
  };
});
