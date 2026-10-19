import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f3efe6",
        ink: "#1c2430",
        pine: "#0f6e56",
        moss: "#1f8f72",
        deep: "#0a3d31",
        line: "#e3d9c8",
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["IBM Plex Serif", "ui-serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
