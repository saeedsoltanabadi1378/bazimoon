import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// Generates the app icons (192, 512, maskable 512, apple-touch-icon) from public/logo.svg.
export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: "#0B0D1A" } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: "#0B0D1A" } },
  },
  images: ["public/logo.svg"],
});
