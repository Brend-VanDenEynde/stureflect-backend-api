const express = require('express');
const swaggerUi = require('swagger-ui-express');

const app = express();

// Swagger specificatie (inline voor Vercel compatibiliteit)
const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'StuReflect Backend API',
    version: '1.0.0',
    description: 'API documentatie voor de StuReflect backend',
    contact: {
      name: 'API Support',
    },
  },
  servers: [
    {
      url: 'https://stureflect-backend-api.vercel.app',
      description: 'Production server',
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  tags: [
    {
      name: 'General',
      description: 'Algemene endpoints',
    },
  ],
  paths: {
    '/': {
      get: {
        summary: 'Root endpoint',
        description: 'Returns a welcome message from the API',
        tags: ['General'],
        responses: {
          200: {
            description: 'Successful response',
            content: {
              'text/plain': {
                schema: {
                  type: 'string',
                  example: 'Hello from Express on Vercel!',
                },
              },
            },
          },
        },
      },
    },
  },
};

// Swagger UI opties met CDN assets voor Vercel
const swaggerUiOptions = {
  customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui.min.css',
  customJs: [
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui-bundle.js',
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui-standalone-preset.js',
  ],
};

// Swagger UI route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// JSON endpoint voor swagger spec
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.get('/', (req, res) => {
  res.send('Hello from Express on Vercel!');
});

module.exports = app;
