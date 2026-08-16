import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        duo: {
          green: "#58cc02",
          greenDark: "#46a302",
          red: "#ff4b4b",
          redDark: "#d33131",
          blue: "#1cb0f6",
          blueDark: "#1899d6",
          yellow: "#ffc800",
          purple: "#ce82ff",
          gray: "#e5e5e5",
          ink: "#3c3c3c",
        },
      },
      boxShadow: {
        btn: "0 4px 0 0 var(--tw-shadow-color)",
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        bounceIn: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        pop: "pop 0.2s ease-out",
        bounceIn: "bounceIn 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
