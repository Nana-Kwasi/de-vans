/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#F26A21", dark: "#E1560F", soft: "#FEEDE2" },
        ink: { DEFAULT: "#1B1D21", soft: "#5B5E66", muted: "#9A9DA6" },
        canvas: "#F4F5F7",
        surface: "#FFFFFF",
        hairline: "#ECEDF0",
        star: "#FF9F1C",
      },
      borderRadius: {
        card: "20px",
        xl2: "24px",
      },
      boxShadow: {
        card: "0 10px 30px rgba(11,11,15,0.06)",
        soft: "0 4px 14px rgba(11,11,15,0.05)",
      },
    },
  },
  plugins: [],
};
