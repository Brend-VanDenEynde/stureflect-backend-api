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
  // Delete from require cache to force fresh load
  const swaggerPath = path.join(__dirname, 'docs', 'swagger.json');
  delete require.cache[require.resolve('./docs/swagger.json')];
  
  const swaggerSpec = require('./docs/swagger.json');
  
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
  next();
});

// Swagger JSON endpoint - laadt dynamisch
app.get('/api-docs.json', (req, res) => {
  const swaggerSpec = getSwaggerSpec();
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Swagger UI setup - herlaadt spec bij elke request
app.use('/api-docs', (req, res, next) => {
  const swaggerSpec = getSwaggerSpec();
  
  const swaggerUiOptions = {
    swaggerOptions: {
      persistAuthorization: false,
    }
  };
  
  // Gebruik de standaard swagger-ui-express setup
  return swaggerUi.setup(swaggerSpec, swaggerUiOptions)(req, res, next);
}, swaggerUi.serve);
// Routes
const generalRoutes = require('./routes/general');
const apiRoutes = require('./routes');
app.use('/', generalRoutes);
app.use('/api', apiRoutes);

module.exports = app;
