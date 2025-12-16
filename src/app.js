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
// Bewaar raw body voor webhook signature verificatie
app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/webhooks')) {
      req.rawBody = buf.toString('utf8');
    }
  }
}));

// Swagger UI opties
const swaggerUiOptions = {
  customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui.min.css',
  customJs: [
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui-bundle.js',
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui-standalone-preset.js',
  ]
};

// Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
// Routes
const generalRoutes = require('./routes/general');
const apiRoutes = require('./routes');
app.use('/', generalRoutes);
app.use('/api', apiRoutes);

module.exports = app;
