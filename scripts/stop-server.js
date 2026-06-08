import { execSync } from 'child_process';

const port = process.env.PORT || 3000;

try {
  const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
  const pids = new Set();
  for (const line of out.split('\n')) {
    const m = line.trim().match(/LISTENING\s+(\d+)\s*$/);
    if (m) pids.add(m[1]);
  }
  for (const pid of pids) {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
    console.log(`Proceso ${pid} en puerto ${port} detenido.`);
  }
  if (pids.size === 0) console.log(`Nada escuchando en el puerto ${port}.`);
} catch {
  console.log(`Nada escuchando en el puerto ${port}.`);
}
