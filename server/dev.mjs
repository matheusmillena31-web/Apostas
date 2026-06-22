import { spawn } from 'node:child_process';
let processes = [];
const backendUrl = `http://localhost:${process.env.BACKEND_PORT ?? 3333}`;

const isBackendRunning = async () => {
  try {
    const response = await fetch(`${backendUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
};

const stopAll = () => {
  for (const child of processes) {
    if (!child.killed) child.kill();
  }
};

const startProcess = (name, command, args, options = {}) => {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
    ...options,
  });

  child.on('error', (error) => {
    console.error(`${name} failed to start: ${error.message}`);
    stopAll();
    process.exit(1);
  });

  return child;
};

if (await isBackendRunning()) {
  console.log(`API-FOOTBALL proxy already running at ${backendUrl}`);
  processes = [startProcess('Vite dev server', process.execPath, ['server/frontendDev.mjs'])];
} else {
  processes = [
    startProcess('API-FOOTBALL proxy', process.execPath, ['server/apiFootballProxy.mjs']),
    startProcess('Vite dev server', process.execPath, ['server/frontendDev.mjs']),
  ];
}

for (const child of processes) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      stopAll();
      process.exit(code);
    }
  });
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAll();
  process.exit(0);
});
