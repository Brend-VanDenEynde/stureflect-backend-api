# Rate Limiter Documentatie

## Overzicht

De StuReflect Backend API gebruikt `express-rate-limit` om bescherming te bieden tegen misbruik en DDoS-aanvallen. Er zijn verschillende rate limiters geïmplementeerd voor verschillende endpoints.

## Rate Limiter Types

### 1. General API Rate Limiter
**Locatie**: Alle `/api/*` routes  
**Limiet**: 100 requests per 15 minuten  
**Gebruik**: Algemene bescherming voor alle API endpoints

```javascript
// Automatisch toegepast op alle /api/* routes
```

### 2. Auth Rate Limiter
**Locatie**: Login en registratie endpoints  
**Limiet**: 5 requests per 15 minuten  
**Speciale features**:
- Telt alleen mislukte pogingen (skipSuccessfulRequests: true)
- Extra streng om brute-force aanvallen te voorkomen

**Endpoints**:
- `POST /api/auth/login`
- `POST /api/auth/register`

### 3. Webhook Rate Limiter
**Locatie**: GitHub webhook endpoints  
**Limiet**: 30 requests per minuut  
**Gebruik**: Bescherming voor geautomatiseerde webhook events

**Endpoints**:
- `POST /api/webhooks/github`

### 4. AI Rate Limiter
**Locatie**: AI/OpenAI gerelateerde endpoints  
**Limiet**: 20 requests per uur  
**Gebruik**: Bescherming voor dure AI operaties

> **Note**: Deze is beschikbaar in de middleware maar moet nog worden toegepast op specifieke endpoints indien nodig.

## Response bij Rate Limit

Wanneer een rate limit wordt bereikt, krijgt de client een `429 Too Many Requests` response:

```json
{
  "error": "Te veel requests van dit IP, probeer het later opnieuw.",
  "retryAfter": "15 minuten"
}
```

## Response Headers

De rate limiter voegt automatisch headers toe aan elk response:

- `RateLimit-Limit`: Maximum aantal requests toegestaan
- `RateLimit-Remaining`: Aantal resterende requests
- `RateLimit-Reset`: Timestamp wanneer de limiet reset

Voorbeeld:
```
RateLimit-Limit: 100
RateLimit-Remaining: 99
RateLimit-Reset: 1702825200
```

## Implementatie

### Rate Limiter Middleware
Locatie: `src/middleware/rateLimiter.js`

```javascript
const { generalLimiter, authLimiter, webhookLimiter, aiLimiter } = require('./middleware/rateLimiter');
```

### Gebruik in Routes

```javascript
// Algemene rate limiter (app.js)
app.use('/api/', generalLimiter);

// Auth rate limiter (authRoutes.js)
router.post('/login', authLimiter, userController.loginUser);
router.post('/register', authLimiter, userController.registerUser);

// Webhook rate limiter (webhookRoutes.js)
router.post('/github', webhookLimiter, webhookController.handleWebhook);
```

## Testen

Een test script is beschikbaar om de rate limiters te testen:

```bash
# Zorg dat de server draait
npm start

# In een andere terminal
node test-rate-limiter.js
```

Het test script test:
1. General API rate limiter (10 requests naar `/api/courses`)
2. Auth rate limiter (8 requests naar `/api/auth/login` - verwacht 3 geblokkeerde requests)
3. Health check (geen rate limit)

## Configuratie Aanpassen

Om de rate limits aan te passen, bewerk `src/middleware/rateLimiter.js`:

```javascript
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Tijd window
  max: 100,                  // Max aantal requests
  message: { /* ... */ }     // Custom error message
});
```

## Best Practices

1. **Authenticatie endpoints**: Gebruik altijd een strikte rate limiter (authLimiter)
2. **Dure operaties**: Gebruik een restrictievere limiter (bijv. aiLimiter)
3. **Webhooks**: Gebruik een aparte limiter met hogere limieten voor geautomatiseerde systemen
4. **Monitoring**: Check de logs voor `[RATE LIMIT]` berichten om misbruik te detecteren

## Logging

Wanneer een rate limit wordt bereikt, wordt dit gelogd:

```
[RATE LIMIT] IP 127.0.0.1 heeft de rate limit bereikt
[AUTH RATE LIMIT] IP 127.0.0.1 heeft te veel authenticatie pogingen gedaan
[WEBHOOK RATE LIMIT] IP 127.0.0.1 heeft de webhook rate limit bereikt
[AI RATE LIMIT] IP 127.0.0.1 heeft de AI rate limit bereikt
```

## Productie Overwegingen

In productie kan je overwegen om:

1. **Redis store** te gebruiken voor rate limiting over meerdere servers:
   ```bash
   npm install rate-limit-redis redis
   ```

2. **IP whitelist** toe te voegen voor vertrouwde services

3. **Dynamische limits** gebaseerd op gebruikersrol (premium gebruikers krijgen hogere limits)

4. **Monitoring & Alerting** instellen voor rate limit violations
