/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Modern Facebook tokens
        "fb-blue": "#1877F2",
        "fb-blue-hover": "#166FE5",
        "fb-blue-active": "#0E5ECE",
        "fb-blue-light": "#E7F3FF",
        "fb-bg": "#F0F2F5",
        "fb-card": "#FFFFFF",
        "fb-text": "#050505",
        "fb-muted": "#65676B",
        "fb-border": "#E4E6EB",
        "fb-border-hover": "#CED0D4",
        "fb-divider": "#E4E6EB",
        "fb-btn-secondary": "#E4E6EB",
        "fb-btn-secondary-hover": "#D8DADF",
        "fb-green": "#31A24C",
        "fb-red": "#FA383E",

        // Mapped defaults to Facebook palette
        paper: "#F0F2F5",
        surface: "#FFFFFF",
        ink: "#050505",
        muted: "#65676B",
        accent: "#1877F2",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        serif: ["Inter", "sans-serif"], // Eliminate Newsreader, fallback cleanly
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
}
