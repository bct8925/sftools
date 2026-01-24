/// <reference types="vite/client" />

// Support for ?raw imports (HTML templates)
declare module '*.html?raw' {
  const content: string;
  export default content;
}

// Support for ?url imports
declare module '*?url' {
  const url: string;
  export default url;
}

// CSS imports (side-effect only in this project)
declare module '*.css';

// Build-time constants
declare const __SFTOOLS_DEBUG__: boolean;
