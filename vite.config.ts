import { defineConfig } from 'vite';
import { saveApiPlugin } from './server/saveApiPlugin';

export default defineConfig({
  root: '.',
  // The save API (intents/45-save-api): /api/saves on the dev AND preview server.
  plugins: [saveApiPlugin()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        mapEditor: 'map-editor.html',
      },
    },
  },
});
