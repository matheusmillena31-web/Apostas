import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  plugins: [react()],
  server: {
    proxy: {
      '/api/futebol': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
});

await server.listen();
server.printUrls();
