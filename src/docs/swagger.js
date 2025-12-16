/**
 * Dynamisch gegenereerde Swagger documentatie
 * Dit voorkomt problemen met het renderen van grote JSON bestanden
 */

const baseSpec = {
  openapi: "3.0.0",
  info: {
    title: "StuReflect Backend API",
    version: "1.0.0",
    description: "Volledige API-documentatie voor StuReflect backend. Deze API biedt volledige ondersteuning voor authenticatie met JWT-tokens, gebruikersbeheer, cursusbeheer. Alle endpoints ondersteunen JSON request/response format.",
    contact: {
      name: "API Ondersteuning",
      email: "support@stureflect.com"
    },
    license: {
      name: "MIT"
    }
  },
  servers: [
    {
      url: "https://backend.stureflect.com",
      description: "Productieserver"
    },
    {
      url: "http://localhost:3000",
      description: "Ontwikkelingserver"
    }
  ],
  tags: [
    {
      name: "Algemeen",
      description: "Algemene endpoints voor API-gezondheid en informatie"
    },
    {
      name: "Authenticatie",
      description: "Endpoints voor gebruiker registratie en inloggen met JWT-authenticatie"
    },
    {
      name: "GitHub OAuth",
      description: "Endpoints voor GitHub OAuth 2.0 authenticatie en private repository access"
    },
    {
      name: "Cursussen",
      description: "Endpoints voor cursusbeheer en cursusgegevens"
    },
    {
      name: "Studenten",
      description: "Endpoints voor student self-service: cursussen en opdrachten bekijken"
    },
    {
      name: "Docenten",
      description: "Endpoints voor docenten om cursussen en studenten te beheren"
    },
    {
      name: "Admin",
      description: "Endpoints voor administratieve taken (alleen voor admins)"
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT Authorization header met Bearer schema. Voorbeeld: 'Authorization: Bearer {token}'"
      }
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "Foutmelding"
          },
          error: {
            type: "string",
            description: "Technische foutdetails"
          }
        }
      },
      User: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "Unieke gebruikers-ID"
          },
          name: {
            type: "string",
            description: "Volledige naam van de gebruiker"
          },
          email: {
            type: "string",
            format: "email",
            description: "E-mailadres van de gebruiker"
          },
          role: {
            type: "string",
            enum: ["student", "teacher", "admin"],
            description: "Rol van de gebruiker in het systeem"
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "Aanmaakdatum van het account"
          }
        }
      },
      Course: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "Unieke cursus-ID"
          },
          code: {
            type: "string",
            description: "Cursuscode (bijv. CS101)"
          },
          name: {
            type: "string",
            description: "Naam van de cursus"
          },
          description: {
            type: "string",
            description: "Beschrijving van de cursus"
          },
          created_at: {
            type: "string",
            format: "date-time"
          }
        }
      },
      Assignment: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "Unieke opdracht-ID"
          },
          course_id: {
            type: "integer",
            description: "ID van de cursus waar deze opdracht bij hoort"
          },
          title: {
            type: "string",
            description: "Titel van de opdracht"
          },
          description: {
            type: "string",
            description: "Beschrijving van de opdracht"
          },
          due_date: {
            type: "string",
            format: "date-time",
            description: "Deadline voor inlevering"
          }
        }
      },
      Submission: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "Unieke inzending-ID"
          },
          assignment_id: {
            type: "integer",
            description: "ID van de opdracht"
          },
          student_id: {
            type: "integer",
            description: "ID van de student"
          },
          github_repo: {
            type: "string",
            description: "GitHub repository URL"
          },
          submitted_at: {
            type: "string",
            format: "date-time",
            description: "Tijdstip van inlevering"
          },
          status: {
            type: "string",
            enum: ["submitted", "graded", "pending"],
            description: "Status van de inzending"
          }
        }
      }
    }
  },
  paths: {
    "/": {
      get: {
        tags: ["Algemeen"],
        summary: "API Root - Welkomstbericht",
        description: "Geeft een welkomstbericht en basisinformatie over de API",
        responses: {
          "200": {
            description: "Succesvol",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      example: "Welcome to StuReflect API"
                    },
                    version: {
                      type: "string",
                      example: "1.0.0"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/health": {
      get: {
        tags: ["Algemeen"],
        summary: "Health Check",
        description: "Controleert of de API actief is",
        responses: {
          "200": {
            description: "API is operationeel",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      example: "OK"
                    },
                    timestamp: {
                      type: "string",
                      format: "date-time"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

// Helper functie om endpoints toe te voegen
function addEndpoints(spec, endpoints) {
  if (endpoints && endpoints.paths) {
    spec.paths = { ...spec.paths, ...endpoints.paths };
  }
  return spec;
}

// Laad de verschillende endpoint definities
function buildSwaggerSpec() {
  let spec = { ...baseSpec };
  
  // Array van alle endpoint bestanden
  const endpointFiles = [
    { name: 'auth-endpoints.json', label: 'Auth' },
    { name: 'admin-endpoints.json', label: 'Admin' },
    { name: 'course-endpoints.json', label: 'Course' },
    { name: 'student-endpoints.json', label: 'Student' },
    { name: 'student-submissions-endpoints.json', label: 'Submission' },
    { name: 'docent-endpoints.json', label: 'Docent' },
    { name: 'github-submission-endpoints.json', label: 'GitHub' }
  ];

  // Laad elk endpoint bestand
  endpointFiles.forEach(({ name, label }) => {
    try {
      const endpoints = require(`./${name}`);
      spec = addEndpoints(spec, endpoints);
      console.log(`✓ ${label} endpoints geladen`);
    } catch (error) {
      console.log(`✗ ${label} endpoints niet gevonden, wordt overgeslagen`);
    }
  });

  return spec;
}

module.exports = buildSwaggerSpec();
