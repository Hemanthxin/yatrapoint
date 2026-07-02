// Ambient declarations so TypeScript accepts side-effect CSS imports
// (e.g. `import "./globals.css"`). Next.js handles the actual bundling.
declare module "*.css";
declare module "*.scss";
