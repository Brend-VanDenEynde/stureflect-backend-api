const express = require('express');
const swaggerUi = require('swagger-ui-express');

console.log('[APP] Laden van Swagger configuratie...');
const swaggerSpec = require('./config/swagger');
console.log(`[SUCCESS] [APP] Swagger geladen met ${Object.keys(swaggerSpec.paths || {}).length} endpoints`);

const session = require('express-session');
const passport = require('./config/passport');
const db = require('./config/db'); // Voeg databaseconfiguratie toe

console.log('[APP] Initialiseren van Express app...');
const app = express();

// CORS Middleware
const cors = require('cors');
console.log('[APP] Configureren van CORS...');
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5174',
    'https://stureflect-frontend.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
console.log('[SUCCESS] [APP] CORS geconfigureerd');

// Session middleware (for Passport)
console.log('[APP] Configureren van sessies...');
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Passport middleware 
console.log('[APP] Initialiseren van Passport authenticatie...');
app.use(passport.initialize());
app.use(passport.session());
console.log('[SUCCESS] [APP] Passport geïnitialiseerd');

// Middleware
app.use(express.json());
console.log('[SUCCESS] [APP] JSON middleware geladen');

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[REQUEST] [${timestamp}] ${req.method} ${req.url}`);
  
  if (req.method !== 'GET') {
    console.log(`[REQUEST]    Body:`, JSON.stringify(req.body).substring(0, 100));
  }
  
  if (req.headers.authorization) {
    console.log(`[REQUEST]    Auth: Bearer token aanwezig`);
  }
  
  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`[RESPONSE]    Status: ${res.statusCode}`);
    originalSend.call(this, data);
  };
  
  next();
});
console.log('[SUCCESS] [APP] Request logging middleware geladen');

// Documentation
console.log('[APP] Configureren van Swagger UI op /api-docs...');
console.log(`[APP] Swagger versie: ${swaggerSpec.openapi}`);
console.log(`[APP] API Title: ${swaggerSpec.info.title}`);
console.log(`[APP] API Version: ${swaggerSpec.info.version}`);
console.log(`[APP] Totaal endpoints: ${Object.keys(swaggerSpec.paths || {}).length}`);

// Gebruik standaard swagger-ui-express zonder custom CDN
// Dit voorkomt versie conflicten
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'StuReflect API Documentation',
  customfavIcon: null,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    syntaxHighlight: {
      activate: true,
      theme: 'monokai'
    }
  }
}));
console.log('[SUCCESS] [APP] Swagger UI beschikbaar op /api-docs');
console.log('[APP] Swagger UI gebruikt bundled versie van swagger-ui-express');

app.get('/api-docs.json', (req, res) => {
  console.log('[API-DOCS] JSON endpoint aangeroepen');
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
console.log('[SUCCESS] [APP] Swagger JSON beschikbaar op /api-docs.json');

// Routes
console.log('[APP] Laden van routes...');
const generalRoutes = require('./routes/general');
const apiRoutes = require('./routes');
app.use('/', generalRoutes);
app.use('/api', apiRoutes);
console.log('[SUCCESS] [APP] Alle routes geladen');

// 404 handler
app.use((req, res) => {
  console.log(`[WARNING] [404] Niet gevonden: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: 'Endpoint niet gevonden',
    error: 'NOT_FOUND',
    path: req.url,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR] Onverwachte fout:');
  console.error('[ERROR]    Pad:', req.url);
  console.error('[ERROR]    Method:', req.method);
  console.error('[ERROR]    Error:', err.message);
  console.error('[ERROR]    Stack:', err.stack);
  
  res.status(err.status || 500).json({
    success: false,
    message: 'Er is een fout opgetreden',
    error: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

console.log('[SUCCESS] [APP] App configuratie compleet!');

module.exports = app;