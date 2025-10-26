// Use CommonJS so PostCSS/Vite can load this synchronously without ESM parsing warnings
// Attempt to load the recommended Tailwind PostCSS plugin if available,
// otherwise fall back to the standard `tailwindcss` export. This keeps
// the config compatible across Tailwind versions and avoids forcing a
// specific plugin dependency in package.json.
let tailwindPlugin;
try {
  tailwindPlugin = require('@tailwindcss/postcss');
} catch (err) {
  tailwindPlugin = require('tailwindcss');
}

module.exports = {
  plugins: [
    tailwindPlugin(),
    require('autoprefixer')(),
  ],
};
