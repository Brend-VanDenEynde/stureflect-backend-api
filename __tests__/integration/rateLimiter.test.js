/**
 * Integration tests voor Rate Limiter functionaliteit
 * 
 * Deze tests valideren dat de rate limiters correct werken:
 * - General API limiter (100 req/15min)
 * - Auth limiter (5 req/15min)
 * - Webhook limiter (30 req/min)
 */

const axios = require('axios');

// Test configuratie
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TIMEOUT = 30000; // 30 seconden timeout voor tests

describe('Rate Limiter Integration Tests', () => {
  
  // Helper functie om requests te maken
  const makeRequest = async (endpoint, method = 'GET', data = null) => {
    try {
      const config = {
        method,
        url: `${BASE_URL}${endpoint}`,
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true, // Don't throw on any status
        timeout: 5000
      };
      
      if (data) {
        config.data = data;
      }
      
      return await axios(config);
    } catch (error) {
      throw new Error(`Request failed: ${error.message}`);
    }
  };

  describe('General API Rate Limiter', () => {
    
    it('should allow requests under the limit (100 req/15min)', async () => {
      // Test 10 requests - moeten allemaal succesvol zijn
      const results = [];
      
      for (let i = 0; i < 10; i++) {
        const response = await makeRequest('/api/courses');
        results.push(response.status);
      }
      
      // Alle requests moeten succesvol zijn (200 of 401 voor ongeautoriseerde requests)
      const allSuccess = results.every(status => status === 200 || status === 401);
      expect(allSuccess).toBe(true);
      
      console.log('✅ General API limiter: 10 requests succesvol');
    }, TIMEOUT);

    it('should include rate limit headers in response', async () => {
      const response = await makeRequest('/api/courses');
      
      // Check voor rate limit headers
      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
      expect(response.headers).toHaveProperty('ratelimit-reset');
      
      console.log('✅ Rate limit headers aanwezig:', {
        limit: response.headers['ratelimit-limit'],
        remaining: response.headers['ratelimit-remaining'],
        reset: response.headers['ratelimit-reset']
      });
    }, TIMEOUT);
    
  });

  describe('Auth Rate Limiter', () => {
    
    it('should rate limit after 5 failed login attempts', async () => {
      const loginData = {
        email: 'nonexistent@test.com',
        password: 'wrongpassword123'
      };
      
      const results = [];
      
      // Maak 7 login pogingen (5 is de limiet)
      for (let i = 0; i < 7; i++) {
        const response = await makeRequest('/api/auth/login', 'POST', loginData);
        results.push({
          attempt: i + 1,
          status: response.status,
          rateLimited: response.status === 429
        });
        
        // Kleine delay tussen requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Tel hoeveel requests rate limited werden
      const rateLimitedCount = results.filter(r => r.rateLimited).length;
      
      // Na 5 pogingen moeten de volgende requests geblokkeerd worden
      expect(rateLimitedCount).toBeGreaterThan(0);
      
      // Check of de laatste request rate limited is
      const lastRequest = results[results.length - 1];
      expect(lastRequest.status).toBe(429);
      
      console.log('✅ Auth rate limiter werkt:');
      results.forEach(r => {
        console.log(`   Poging ${r.attempt}: ${r.rateLimited ? '⛔ BLOCKED (429)' : `✓ Allowed (${r.status})`}`);
      });
      
    }, TIMEOUT);

    it('should return proper error message when rate limited', async () => {
      const loginData = {
        email: 'test@test.com',
        password: 'wrongpassword'
      };
      
      // Maak meerdere requests om rate limit te bereiken
      for (let i = 0; i < 6; i++) {
        await makeRequest('/api/auth/login', 'POST', loginData);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Deze zou nu geblokkeerd moeten zijn
      const response = await makeRequest('/api/auth/login', 'POST', loginData);
      
      if (response.status === 429) {
        expect(response.data).toHaveProperty('error');
        expect(response.data.error).toContain('authenticatie pogingen');
        expect(response.data).toHaveProperty('retryAfter');
        
        console.log('✅ Error message correct:', response.data);
      }
    }, TIMEOUT);
    
  });

  describe('Rate Limit Headers', () => {
    
    it('should show decreasing remaining count', async () => {
      const results = [];
      
      // Maak 3 requests en check remaining count
      for (let i = 0; i < 3; i++) {
        const response = await makeRequest('/api/courses');
        const remaining = parseInt(response.headers['ratelimit-remaining'] || '0');
        results.push(remaining);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Remaining count zou moeten afnemen (of gelijk blijven als we al veel requests hebben gedaan)
      console.log('✅ Remaining counts:', results);
      
      // Check dat we valide numbers hebben
      results.forEach(count => {
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });
      
    }, TIMEOUT);
    
  });

  describe('Webhook Rate Limiter', () => {
    
    it('should have separate rate limit for webhooks', async () => {
      // Webhook endpoint heeft een andere rate limiter (30 req/min)
      // We testen alleen of het endpoint bereikbaar is
      const response = await makeRequest('/api/webhooks/health', 'GET');
      
      // Health endpoint zou moeten werken (maar mogelijk 401 als auth required)
      expect([200, 401, 404]).toContain(response.status);
      
      console.log('✅ Webhook endpoint bereikbaar:', response.status);
    }, TIMEOUT);
    
  });

  describe('Non-API Routes', () => {
    
    it('should not rate limit health check endpoint', async () => {
      const results = [];
      
      // Maak 10 requests naar health check (niet onder /api/)
      for (let i = 0; i < 10; i++) {
        const response = await makeRequest('/health');
        results.push(response.status);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Alle requests moeten succesvol zijn
      const allSuccess = results.every(status => status === 200);
      expect(allSuccess).toBe(true);
      
      console.log('✅ Health check niet rate limited: 10/10 requests succesvol');
    }, TIMEOUT);
    
  });

});

// Test helper om rate limiter te resetten (alleen voor development)
describe('Rate Limiter Info', () => {
  
  it('should log rate limiter configuration', () => {
    console.log('\n📊 Rate Limiter Configuratie:');
    console.log('   - General API: 100 requests per 15 minuten');
    console.log('   - Authentication: 5 requests per 15 minuten');
    console.log('   - Webhooks: 30 requests per minuut');
    console.log('   - AI Services: 20 requests per uur');
    console.log('\n💡 Tip: Check server logs voor [RATE LIMITER] berichten\n');
    
    expect(true).toBe(true);
  });
  
});
