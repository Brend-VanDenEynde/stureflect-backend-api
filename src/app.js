const express = require('express');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const swaggerSpec = require('./docs/swagger.json');

const app = express();

// Load auth OpenAPI spec
let openApiAuthSpec;
try {
  const authSpecPath = path.join(__dirname, '..', 'docs', 'openapi-auth.json');
  const authSpecContent = fs.readFileSync(authSpecPath, 'utf8');
  openApiAuthSpec = JSON.parse(authSpecContent);
} catch (err) {
  console.error('Error loading openapi-auth.json:', err.message);
  openApiAuthSpec = {};
}

// Middleware
app.use(express.json());

// Swagger UI opties met CDN assets voor Vercel
const swaggerUiOptions = {
  customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui.min.css',
  customJs: [
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui-bundle.js',
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui-standalone-preset.js',
  ],
  swaggerOptions: {
    urls: [
      {
        url: '/api-docs.json',
        name: 'API Documentation'
      },
      {
        url: '/api-docs-auth.json',
        name: 'Authentication API'
      }
    ]
  }
};

// Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
app.get('/api-docs-auth.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(openApiAuthSpec);
});

// Routes
const generalRoutes = require('./routes/general');
const apiRoutes = require('./routes');

app.use('/', generalRoutes);
app.use('/api', apiRoutes);


module.exports = app;
