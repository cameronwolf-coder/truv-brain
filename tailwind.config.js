
/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'truv-blue': '#2c64e3',
                'truv-blue-dark': '#0f1c47',
                'truv-blue-light': '#c5d9f7',
                'background': '#f4f4f2',
            },
            fontFamily: {
                sans: ['Gilroy', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
