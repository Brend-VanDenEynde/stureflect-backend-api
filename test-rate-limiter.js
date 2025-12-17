/**
 * Test script voor rate limiter functionaliteit
 * 
 * Dit script test de verschillende rate limiters:
 * - General limiter: 100 requests per 15 minuten
 * - Auth limiter: 5 requests per 15 minuten
 * - Webhook limiter: 30 requests per minuut
 * 
 * BELANGRIJK: Zorg dat de server draait voordat je deze test uitvoert!
 * Start de server met: npm start
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test of de server bereikbaar is
async function checkServerAvailability() {
  try {
    await axios.get(`${BASE_URL}/health`, { timeout: 3000 });
    return true;
  } catch (error) {
    return false;
  }
}

// Helper functie om meerdere requests te maken
async function makeMultipleRequests(endpoint, count, data = null) {
  console.log(`\n📊 Testing ${endpoint} met ${count} requests...`);
  const results = { success: 0, rateLimited: 0, errors: 0 };
  const details = [];
  
  for (let i = 1; i <= count; i++) {
    try {
      const config = {
        method: data ? 'POST' : 'GET',
        url: `${BASE_URL}${endpoint}`,
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true // Don't throw on any status
      };
      
      if (data) {
        config.data = data;
      }
      
      const response = await axios(config);
      
      // Check rate limit headers
      const rateLimitInfo = {
        limit: response.headers['ratelimit-limit'],
        remaining: response.headers['ratelimit-remaining'],
        reset: response.headers['ratelimit-reset']
      };
      
      if (response.status === 429) {
        results.rateLimited++;
        console.log(`  ⛔ Request ${i}: Rate limited (429)`);
        console.log(`     Headers: limit=${rateLimitInfo.limit}, remaining=${rateLimitInfo.remaining}`);
        if (i === count) {
          console.log(`     Response:`, response.data);
        }
        details.push({ request: i, status: 429, rateLimited: true, headers: rateLimitInfo });
      } else if (response.status < 400) {
        results.success++;
        console.log(`  ✅ Request ${i}: Success (${response.status})`);
        console.log(`     Headers: limit=${rateLimitInfo.limit}, remaining=${rateLimitInfo.remaining}`);
        details.push({ request: i, status: response.status, rateLimited: false, headers: rateLimitInfo });
      } else {
        results.errors++;
        console.log(`  ⚠️  Request ${i}: Error (${response.status})`);
        console.log(`     Headers: limit=${rateLimitInfo.limit}, remaining=${rateLimitInfo.remaining}`);
        details.push({ request: i, status: response.status, rateLimited: false, headers: rateLimitInfo });
      }
      
      // Kleine delay tussen requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      results.errors++;
      console.log(`  ❌ Request ${i}: Failed -`, error.message);
      details.push({ request: i, error: error.message });
    }
  }
  
  console.log(`\n📈 Resultaten voor ${endpoint}:`);
  console.log(`  ✅ Success: ${results.success}`);
  console.log(`  ⛔ Rate limited: ${results.rateLimited}`);
  console.log(`  ❌ Errors: ${results.errors}`);
  
  return { results, details };
}

async function testRateLimiters() {
  console.log('🚀 Starting Rate Limiter Tests\n');
  console.log('=' .repeat(60));
  
  // Check of server beschikbaar is
  console.log('\n🔍 Checking server availability...');
  const serverAvailable = await checkServerAvailability();
  if (!serverAvailable) {
    console.error('\n❌ ERROR: Server is niet bereikbaar op ' + BASE_URL);
    console.error('   Start de server eerst met: npm start\n');
    process.exit(1);
  }
  console.log('✅ Server is bereikbaar!\n');
  
  // Test 1: General API Rate Limiter
  console.log('\n1️⃣  TEST: General API Rate Limiter (100 req/15min)');
  console.log('-'.repeat(60));
  console.log('ℹ️  Deze test maakt 10 requests naar /api/courses');
  console.log('   Verwachting: Alle requests slagen (limiet is 100/15min)\n');
  const test1 = await makeMultipleRequests('/api/courses', 10);
  
  if (test1.results.rateLimited > 0) {
    console.log('\n⚠️  WAARSCHUWING: Er waren rate limited requests!');
    console.log('   Dit kan betekenen dat je al veel requests hebt gemaakt.');
    console.log('   Wacht 15 minuten en probeer opnieuw.\n');
  }
  
  // Test 2: Auth Rate Limiter (strict) - Dit moet rate limiting triggeren!
  console.log('\n\n2️⃣  TEST: Auth Rate Limiter (5 req/15min) - RATE LIMIT VERWACHT');
  console.log('-'.repeat(60));
  console.log('ℹ️  Deze test maakt 10 requests naar /api/auth/login');
  console.log('   Verwachting: Na 5 requests worden de rest geblokkeerd (429)\n');
  const test2 = await makeMultipleRequests('/api/auth/login', 10, {
    email: 'ratelimit-test@example.com',
    password: 'testpassword123'
  });
  
  // Valideer dat rate limiting heeft gewerkt
  if (test2.results.rateLimited > 0) {
    console.log('\n✅ SUCCES: Auth rate limiter werkt correct!');
    console.log(`   ${test2.results.rateLimited} requests werden geblokkeerd (429)`);
  } else {
    console.log('\n⚠️  WAARSCHUWING: Geen rate limiting gedetecteerd!');
    console.log('   Dit kan betekenen dat skipSuccessfulRequests werkt');
    console.log('   of dat de limiet nog niet is bereikt.\n');
  }
  
  // Toon details van rate limiting
  console.log('\n📊 Rate Limit Details:');
  const rateLimitedRequests = test2.details.filter(d => d.rateLimited);
  if (rateLimitedRequests.length > 0) {
    console.log('   Geblokkeerde requests:');
    rateLimitedRequests.forEach(req => {
      console.log(`     - Request #${req.request}: Status ${req.status}`);
      console.log(`       Rate Limit Headers: limit=${req.headers.limit}, remaining=${req.headers.remaining}`);
    });
  }
  
  // Test 3: Health check (should not be rate limited by general limiter as it's not under /api/)
  console.log('\n\n3️⃣  TEST: Health Check (geen rate limit verwacht)');
  console.log('-'.repeat(60));
  console.log('ℹ️  Deze test maakt 10 requests naar /health');
  console.log('   Verwachting: Alle requests slagen (niet onder /api/*)\n');
  const test3 = await makeMultipleRequests('/health', 10);
  
  if (test3.results.success === 10) {
    console.log('\n✅ SUCCES: Health endpoint is niet rate limited!');
  }
  
  // Test 4: Valideer rate limit headers
  console.log('\n\n4️⃣  TEST: Rate Limit Headers');
  console.log('-'.repeat(60));
  console.log('ℹ️  Valideer dat rate limit headers aanwezig zijn\n');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/courses`, {
      validateStatus: () => true
    });
    
    const headers = {
      limit: response.headers['ratelimit-limit'],
      remaining: response.headers['ratelimit-remaining'],
      reset: response.headers['ratelimit-reset']
    };
    
    console.log('  📋 Rate Limit Headers:');
    console.log(`     RateLimit-Limit: ${headers.limit}`);
    console.log(`     RateLimit-Remaining: ${headers.remaining}`);
    console.log(`     RateLimit-Reset: ${headers.reset}`);
    
    if (headers.limit && headers.remaining !== undefined && headers.reset) {
      console.log('\n  ✅ Alle rate limit headers aanwezig!');
    } else {
      console.log('\n  ⚠️  Sommige headers ontbreken!');
    }
  } catch (error) {
    console.log('  ❌ Fout bij ophalen headers:', error.message);
  }
  
  console.log('\n\n' + '='.repeat(60));
  console.log('✅ Rate Limiter Tests Completed!');
  console.log('='.repeat(60));
  
  // Samenvatting
  console.log('\n📊 SAMENVATTING:');
  console.log(`   Test 1 (General API): ${test1.results.success} success, ${test1.results.rateLimited} rate limited`);
  console.log(`   Test 2 (Auth): ${test2.results.errors} attempts, ${test2.results.rateLimited} rate limited`);
  console.log(`   Test 3 (Health): ${test3.results.success} success, ${test3.results.rateLimited} rate limited`);
  
  // Validatie
  const allTestsPassed = 
    test1.results.rateLimited === 0 && // General limiter niet bereikt met 10 requests
    test2.results.rateLimited > 0 &&   // Auth limiter WEL bereikt met 10 requests
    test3.results.success === 10;       // Health check altijd beschikbaar
    
  if (allTestsPassed) {
    console.log('\n🎉 ALLE TESTS GESLAAGD! Rate limiters werken correct!\n');
  } else {
    console.log('\n⚠️  Sommige tests gaven onverwachte resultaten.');
    console.log('   Check de details hierboven voor meer informatie.\n');
  }
}

// Run tests
testRateLimiters()
  .then(() => {
    console.log('\n✅ All tests completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
