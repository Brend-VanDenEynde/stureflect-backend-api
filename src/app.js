const express = require('express');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const passport = require('./config/passport');
const db = require('./config/db'); // Voeg databaseconfiguratie toe

const app = express();

// CORS Middleware
const cors = require('cors');
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

// Session middleware (for Passport)
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
app.use(passport.initialize());
app.use(passport.session());

// Middleware
app.use(express.json());

// Functie om swagger spec ALTIJD vers in te laden
function getSwaggerSpec() {
  const swaggerPath = path.join(__dirname, 'docs', 'swagger.json');
  const swaggerFile = fs.readFileSync(swaggerPath, 'utf8');
  const swaggerSpec = JSON.parse(swaggerFile);
  
  // Voeg unieke versie toe gebaseerd op tijdstip
  swaggerSpec.info.version = Date.now().toString();
  
  return swaggerSpec;
}

// Middleware om caching VOLLEDIG uit te schakelen voor Swagger endpoints
app.use(/^\/api-docs/, (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('ETag', Date.now().toString()); // Unieke ETag per request
  next();
});

// Swagger JSON endpoint - laadt dynamisch
app.get('/api-docs.json', (req, res) => {
  const swaggerSpec = getSwaggerSpec();
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Swagger UI - gebruik serve middleware voor assets en laad spec dynamisch
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', (req, res, next) => {
  const swaggerSpec = getSwaggerSpec();
  const version = swaggerSpec.info.version;
  
  const swaggerUiOptions = {
    customCssUrl: `https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui.min.css?v=${version}`,
    customJs: [
      `https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui-bundle.js?v=${version}`,
      `https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui-standalone-preset.js?v=${version}`,
    ],
    swaggerOptions: {
      persistAuthorization: false,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true
    }
  };
  
  // Gebruik setup met spec
  swaggerUi.setup(swaggerSpec, swaggerUiOptions)(req, res, next);
});
// Routes
const generalRoutes = require('./routes/general');
const apiRoutes = require('./routes');
app.use('/', generalRoutes);
app.use('/api', apiRoutes);

module.exports = app;
