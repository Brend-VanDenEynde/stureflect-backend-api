const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

console.log('📚 Initialiseren van Swagger documentatie...');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'StuReflect Backend API',
      version: '1.0.0',
      description: 'Volledige API-documentatie voor StuReflect backend. Deze API biedt volledige ondersteuning voor authenticatie met JWT-tokens, gebruikersbeheer, cursusbeheer.',
      contact: {
        name: 'API Ondersteuning',
        email: 'support@stureflect.com'
      },
      license: {
        name: 'MIT'
      }
    },
    servers: [
      {
        url: 'https://backend.stureflect.com',
        description: 'Productieserver'
      },
      {
        url: 'http://localhost:3000',
        description: 'Ontwikkelingserver'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header met Bearer schema. Voorbeeld: "Authorization: Bearer {token}"'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Foutmelding'
            },
            error: {
              type: 'string',
              description: 'Technische foutdetails'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unieke gebruikers-ID'
            },
            name: {
              type: 'string',
              description: 'Volledige naam van de gebruiker'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'E-mailadres van de gebruiker'
            },
            role: {
              type: 'string',
              enum: ['student', 'teacher', 'admin'],
              description: 'Rol van de gebruiker in het systeem'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Aanmaakdatum van het account'
            }
          }
        },
        Course: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unieke cursus-ID'
            },
            code: {
              type: 'string',
              description: 'Cursuscode (bijv. CS101)'
            },
            name: {
              type: 'string',
              description: 'Naam van de cursus'
            },
            description: {
              type: 'string',
              description: 'Beschrijving van de cursus'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Assignment: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unieke opdracht-ID'
            },
            course_id: {
              type: 'integer',
              description: 'ID van de cursus waar deze opdracht bij hoort'
            },
            title: {
              type: 'string',
              description: 'Titel van de opdracht'
            },
            description: {
              type: 'string',
              description: 'Beschrijving van de opdracht'
            },
            due_date: {
              type: 'string',
              format: 'date-time',
              description: 'Deadline voor inlevering'
            }
          }
        },
        Submission: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unieke inzending-ID'
            },
            assignment_id: {
              type: 'integer',
              description: 'ID van de opdracht'
            },
            student_id: {
              type: 'integer',
              description: 'ID van de student'
            },
            github_repo: {
              type: 'string',
              description: 'GitHub repository URL'
            },
            submitted_at: {
              type: 'string',
              format: 'date-time',
              description: 'Tijdstip van inlevering'
            },
            status: {
              type: 'string',
              enum: ['submitted', 'graded', 'pending'],
              description: 'Status van de inzending'
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Algemeen',
        description: 'Algemene endpoints voor API-gezondheid en informatie'
      },
      {
        name: 'Authenticatie',
        description: 'Endpoints voor gebruiker registratie en inloggen met JWT-authenticatie'
      },
      {
        name: 'GitHub OAuth',
        description: 'Endpoints voor GitHub OAuth 2.0 authenticatie en private repository access'
      },
      {
        name: 'Cursussen',
        description: 'Endpoints voor cursusbeheer en cursusgegevens'
      },
      {
        name: 'Studenten',
        description: 'Endpoints voor student self-service: cursussen en opdrachten bekijken'
      },
      {
        name: 'Docenten',
        description: 'Endpoints voor docenten om cursussen en studenten te beheren'
      },
      {
        name: 'Admin',
        description: 'Endpoints voor administratieve taken (alleen voor admins)'
      }
    ]
  },
  // Paden naar alle route bestanden waar JSDoc comments staan
  apis: [
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../controllers/*.js')
  ]
};

console.log('📂 Scannen van bestanden voor JSDoc comments...');
console.log('   - Routes:', path.join(__dirname, '../routes/*.js'));
console.log('   - Controllers:', path.join(__dirname, '../controllers/*.js'));

const swaggerSpec = swaggerJsdoc(options);

const pathCount = Object.keys(swaggerSpec.paths || {}).length;
console.log(`✅ Swagger spec gegenereerd met ${pathCount} endpoints`);

if (pathCount === 0) {
  console.log('⚠️  WAARSCHUWING: Geen endpoints gevonden! Check JSDoc comments.');
} else {
  console.log('📋 Gevonden endpoints:');
  Object.keys(swaggerSpec.paths).forEach(path => {
    const methods = Object.keys(swaggerSpec.paths[path]);
    console.log(`   - ${methods.map(m => m.toUpperCase()).join(', ')} ${path}`);
  });
}

module.exports = swaggerSpec;
