/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Nunito", "system-ui", "sans-serif"], ar: ["Cairo", "sans-serif"] },
      colors: {
        // NASJ design system (see src/index.css for the CSS variables)
        teal: { DEFAULT: "#2E9185", dark: "#176B63", soft: "#D7F1EA" },
        coral: { DEFAULT: "#F39A9B", soft: "#FDE3E1" },
        sun: { DEFAULT: "#F6BB48", soft: "#FDEFCB" },
        grape: { DEFAULT: "#9B7FC8", soft: "#E9DFF8" },
        lavender: "#D9C8F1",
        sky: { DEFAULT: "#BDE8FA", soft: "#E3F4FC" },
        leaf: "#B7DCA1",
        cream: "#FFF7E9",
        ink: "#284E4A",
        mute: "#718681",
      },
      borderRadius: { card: "28px", pill: "999px" },
      boxShadow: { soft: "0 8px 24px rgba(23,107,99,.16)", pop: "0 4px 0 rgba(23,107,99,.32)", card: "0 10px 30px rgba(23,107,99,.14)" },
    },
  },
  plugins: [],
};
