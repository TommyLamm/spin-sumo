import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [
    {
      name: 'copy-game-manifest-and-cover',
      closeBundle() {
        const dist = path.resolve(__dirname, 'dist');
        if (!fs.existsSync(dist)) {
          fs.mkdirSync(dist, { recursive: true });
        }
        const gameJsonSrc = path.resolve(__dirname, 'game.json');
        const coverPngSrc = path.resolve(__dirname, 'cover.png');
        if (fs.existsSync(gameJsonSrc)) {
          fs.copyFileSync(gameJsonSrc, path.join(dist, 'game.json'));
        }
        if (fs.existsSync(coverPngSrc)) {
          fs.copyFileSync(coverPngSrc, path.join(dist, 'cover.png'));
        }
        const sdkJsSrc = path.resolve(__dirname, 'playroom-sdk.js');
        const sdkDtsSrc = path.resolve(__dirname, 'playroom-sdk.d.ts');
        if (fs.existsSync(sdkJsSrc)) {
          fs.copyFileSync(sdkJsSrc, path.join(dist, 'playroom-sdk.js'));
        }
        if (fs.existsSync(sdkDtsSrc)) {
          fs.copyFileSync(sdkDtsSrc, path.join(dist, 'playroom-sdk.d.ts'));
        }
      },
    },
  ],
});
