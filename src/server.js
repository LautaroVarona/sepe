import app, { APP_VERSION } from './app.js';

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`SEPEIMP v${APP_VERSION} — http://localhost:${PORT}`);
});
