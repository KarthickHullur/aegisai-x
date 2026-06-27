/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#5B5FFB',
          secondary: '#8B5CF6',
          accent: '#EC4899',
          background: '#F8FAFC',
          card: '#FFFFFF',
          textPrimary: '#0F172A',
          textSecondary: '#64748B',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'main-gradient': 'linear-gradient(135deg, #5B5FFB 0%, #8B5CF6 50%, #EC4899 100%)',
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(91, 95, 251, 0.05), 0 2px 12px -1px rgba(0, 0, 0, 0.03)',
        'premium': '0 10px 30px -5px rgba(0, 0, 0, 0.05), 0 4px 12px -2px rgba(0, 0, 0, 0.02)',
      }
    },
  },
  plugins: [],
}
