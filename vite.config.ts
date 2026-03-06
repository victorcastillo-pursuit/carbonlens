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
        },
        // Uncomment if USPVDB blocks browser CORS requests:
        // '/api/uspvdb': {
        //   target: 'https://energy.usgs.gov/api/uspvdb/v1',
        //   changeOrigin: true,
        //   rewrite: (path) => path.replace(/^\/api\/uspvdb/, ''),
        // },
      },
    },
  };
});
