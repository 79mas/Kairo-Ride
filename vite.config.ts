import react from "@vitejs/plugin-react";
import {defineConfig,loadEnv} from "vite";
import {fileURLToPath,URL} from "node:url";
import {kairoPwa} from "./build/kairo-pwa";
import {normalizeBasePath} from "./lib/kairo/paths";

// This template becomes vite.config.ts in the standalone GitHub package.
// Only static HTML, CSS, JavaScript and icons are deployed to GitHub Pages.
export default defineConfig(({mode})=>{
  const env=loadEnv(mode,process.cwd(),"KAIRO_");
  const base=normalizeBasePath(process.env.KAIRO_BASE_PATH??env.KAIRO_BASE_PATH??"");
  process.env.KAIRO_BASE_PATH=base;
  return {
  base:base+"/",
  resolve:{alias:{"@":fileURLToPath(new URL(".",import.meta.url))}},
  define:{"process.env.NEXT_PUBLIC_BASE_PATH":JSON.stringify(base)},
  plugins:[react(),kairoPwa()],
  build:{outDir:"dist/client",emptyOutDir:true},
  };
});
