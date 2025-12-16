const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./docs/swagger.json');
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

// Swagger versie voor cache busting - gebruik timestamp voor ALTIJD verse versie
const SWAGGER_VERSION = Date.now().toString();

// Voeg versie toe aan swagger spec
const swaggerSpecWithVersion = {
  ...swaggerSpec,
  info: {
    ...swaggerSpec.info,
    version: SWAGGER_VERSION
  }
};

// Swagger UI opties met agressieve cache busting op alle assets
const swaggerUiOptions = {
  customCssUrl: `https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui.min.css?v=${SWAGGER_VERSION}`,
  customJs: [
    `https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui-bundle.js?v=${SWAGGER_VERSION}`,
    `https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui-standalone-preset.js?v=${SWAGGER_VERSION}`,
  ],
  swaggerOptions: {
    persistAuthorization: false,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true
  }
};

// Middleware om caching uit te schakelen voor Swagger endpoints
app.use('/api-docs', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// Documentation - geef spec direct mee met versie
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecWithVersion, swaggerUiOptions));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.send(swaggerSpecWithVersion);
});
// Routes
const generalRoutes = require('./routes/general');
const apiRoutes = require('./routes');
app.use('/', generalRoutes);
app.use('/api', apiRoutes);

module.exports = app;
