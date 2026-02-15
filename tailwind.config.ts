import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // SAYS 2.0 Premium Dark Mode - Custom Design Tokens
        'says-base': '#020617',      // Ultra-dark navy (page background)
        'says-card': '#0f172a',      // Deep dark blue (card/container background)
        'says-accent': '#ef4444',    // Vivid red (primary actions, alerts)
        'says-subtle': '#1e293b',    // Slate for secondary elements
        'says-muted': '#64748b',     // Muted slate for disabled/secondary text
      },
      backgroundImage: {
        'glass-effect': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
        'gradient-accent': 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      },
      backdropBlur: {
        'glass': '10px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(15, 23, 42, 0.37)',
        'glass-accent': '0 8px 32px 0 rgba(239, 68, 68, 0.15)',
        'elevation-1': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'elevation-2': '0 4px 16px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.8' },
        },
      },
      transitionDuration: {
        '200': '200ms',
        '300': '300ms',
      },
    },
  },
  experimental: {
    optimizeUniversalDefaults: true,
  },
  future: {
    disableColorOpacityUtilitiesByDefault: true,
  },
  plugins: [],
};
export default config;