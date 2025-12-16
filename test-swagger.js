const swaggerSpec = require('./src/config/swagger');

console.log('=== Swagger Spec Test ===');
console.log('OpenAPI Version:', swaggerSpec.openapi);
console.log('Title:', swaggerSpec.info.title);
console.log('\nAvailable paths:');
console.log(Object.keys(swaggerSpec.paths || {}));
console.log('\nTotal endpoints:', Object.keys(swaggerSpec.paths || {}).length);

if (Object.keys(swaggerSpec.paths || {}).length === 0) {
  console.log('\n⚠️  WARNING: No paths found! JSDoc comments might not be parsed correctly.');
} else {
  console.log('\n✅ Swagger spec generated successfully with', Object.keys(swaggerSpec.paths).length, 'endpoints');
}
