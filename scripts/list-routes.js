// Simple script to list registered routes from the Express app
// This intentionally avoids complex regexp parsing; it prints route paths and, when available,
// the router regexp used for mounting (so you can confirm the /api prefix).
const app = require('../src/app');

function extractRoutes(app) {
  const routes = [];
  const stack = app._router && app._router.stack ? app._router.stack : [];

  stack.forEach((layer) => {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
      routes.push({ path: layer.route.path, methods, mount: null });
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      const mountRegexp = layer.regexp ? layer.regexp.toString() : null;
      layer.handle.stack.forEach((handler) => {
        if (handler.route && handler.route.path) {
          const methods = Object.keys(handler.route.methods).map(m => m.toUpperCase());
          routes.push({ path: handler.route.path, methods, mount: mountRegexp });
        }
      });
    }
  });

  return routes;
}

// Try to inspect the mounted router directly (safer and independent of app internals)
const docentRouter = require('../src/routes/docent');
function extractFromRouter(router, mountInfo = null) {
  const r = [];
  const stack = router.stack || [];
  stack.forEach((layer) => {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
      r.push({ path: layer.route.path, methods, mount: mountInfo });
    }
  });
  return r;
}

const routesFromRouter = extractFromRouter(docentRouter, '/api');
console.log(JSON.stringify({ count: routesFromRouter.length, routes: routesFromRouter }, null, 2));
