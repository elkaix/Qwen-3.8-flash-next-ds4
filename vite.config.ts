import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/* `base: "./"` keeps asset URLs relative, so the same build runs at a domain root
   or under a repository subpath (GitHub Pages) without a rebuild flag. */
export default defineConfig({
  base: "./",
  plugins: [react()],
});
