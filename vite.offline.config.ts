import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function singleHtml(): Plugin {
  return {
    name: 'dashboard-single-html',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const page = bundle['index.html'];
        if (!page || page.type !== 'asset') throw new Error('Offline build is missing index.html');
        let html = typeof page.source === 'string' ? page.source : Buffer.from(page.source).toString('utf8');
        let scripts = 0;
        let styles = 0;
        html = html.replace(/<script\b[^>]*\bsrc=(["'])(.*?)\1[^>]*>\s*<\/script>/gi, (_tag, _quote, url: string) => {
          const name = url.replace(/^\.\//, '');
          const chunk = bundle[name];
          // Rolldown may retain the entry itself in dynamic-import metadata after inlining.
          if (!chunk || chunk.type !== 'chunk' || chunk.imports.length || chunk.dynamicImports.some((dependency) => dependency !== name)) {
            throw new Error(`Offline script must be self-contained: ${url}; ${JSON.stringify({
              type: chunk?.type,
              imports: chunk?.type === 'chunk' ? chunk.imports : [],
              dynamicImports: chunk?.type === 'chunk' ? chunk.dynamicImports : [],
              files: Object.keys(bundle),
            })}`);
          }
          scripts++;
          delete bundle[name];
          return `<script type="module">${chunk.code.replace(/<\/script/gi, '<\\/script')}</script>`;
        });
        html = html.replace(/<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=(["'])(.*?)\1[^>]*>/gi, (_tag, _quote, url: string) => {
          const name = url.replace(/^\.\//, '');
          const asset = bundle[name];
          if (!asset || asset.type !== 'asset') throw new Error(`Offline stylesheet is missing: ${url}`);
          const css = typeof asset.source === 'string' ? asset.source : Buffer.from(asset.source).toString('utf8');
          styles++;
          delete bundle[name];
          return `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`;
        });
        const remaining = Object.keys(bundle).filter((name) => name !== 'index.html');
        if (scripts !== 1 || styles !== 1 || remaining.length) {
          throw new Error(`Offline build must contain one script, one stylesheet and no external assets: ${remaining.join(', ')}`);
        }
        delete bundle['index.html'];
        const fileName = 'ai-trust-dashboard.html';
        this.emitFile({ type: 'asset', fileName, source: html });
      },
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [react(), singleHtml()],
  resolve: {
    alias: [{
      find: './survey-runtime.ts',
      replacement: fileURLToPath(new URL('./src/hooks/survey-runtime.offline.ts', import.meta.url)),
    }],
  },
  build: {
    outDir: 'dist-offline',
    modulePreload: false,
    cssCodeSplit: false,
    assetsInlineLimit: () => true,
    rolldownOptions: {
      output: { codeSplitting: false },
    },
  },
});
