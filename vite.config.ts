import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 6138,
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'chart-renderer', test: /[/\\]node_modules[/\\]zrender[/\\]/ }],
        },
      },
    },
  },
});
