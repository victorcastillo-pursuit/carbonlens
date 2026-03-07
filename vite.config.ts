import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/eia': {
          target: 'https://api.eia.gov/v2',
          changeOrigin: true,
          rewrite: (path) => {
            const cleaned = path.replace(/^\/api\/eia/, '');
            const separator = cleaned.includes('?') ? '&' : '?';
            return cleaned + separator + 'api_key=' + env.VITE_EIA_API_KEY;
          },
          configure: (proxy) => {
            proxy.on('proxyReq', (_proxyReq, req) => {
              const key = env.VITE_EIA_API_KEY;
              const keyStatus = key ? `key=${key.slice(0, 4)}…(${key.length} chars)` : 'KEY MISSING';
              console.log(`[vite-proxy] EIA → https://api.eia.gov/v2${req.url} [${keyStatus}]`);
            });
            proxy.on('error', (err) => {
              console.error('[vite-proxy] EIA error:', err.message);
            });
          },
        },
        '/api/uspvdb': {
          target: 'https://energy.usgs.gov/api/uspvdb/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/uspvdb/, ''),
        },
      },
    },
  };
});
