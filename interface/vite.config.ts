// Vite for the interface (`npm run interface`): Tailwind's plugin builds the
// classes shadcn/ui's components use, from styles/index.css.
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss()],
});
