console.log('================================');
console.log('[STARTUP] STUREFLECT BACKEND API');
console.log('================================');
console.log(`[STARTUP] Start tijd: ${new Date().toISOString()}`);
console.log(`[STARTUP] Omgeving: ${process.env.NODE_ENV || 'development'}`);
console.log(`[STARTUP] Node versie: ${process.version}`);
console.log('================================\n');

const app = require('./src/app');

const PORT = process.env.PORT || 3000;

console.log(`\n================================`);
console.log(`[STARTUP] Server starten op poort ${PORT}...`);
console.log('================================\n');

app.listen(PORT, () => {
  console.log('================================');
  console.log('[SUCCESS] SERVER ACTIEF');
  console.log('================================');
  console.log(`[SERVER] Server draait op: http://localhost:${PORT}`);
  console.log(`[SERVER] Swagger UI: http://localhost:${PORT}/api-docs`);
  console.log(`[SERVER] Swagger JSON: http://localhost:${PORT}/api-docs.json`);
  console.log(`[SERVER] Health check: http://localhost:${PORT}/health`);
  console.log('================================\n');
});
