import { preview } from 'vite';

const server = await preview({
  configFile: false,
});

server.printUrls();
