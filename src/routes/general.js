const express = require('express');
const path = require('path');
const router = express.Router();

/**
 * @swagger
 * /:
 *   get:
 *     tags:
 *       - Algemeen
 *     summary: API Root - Welkomstbericht
 *     description: Geeft een welkomstbericht en basisinformatie over de API
 *     responses:
 *       200:
 *         description: Succesvol
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Hello from Express on Vercel!
 */
router.get('/', (req, res) => {
  // Serveer test UI voor development
  console.log('[ROOT] Root endpoint aangeroepen - serving test UI');
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

/**
 * @swagger
 * /health:
 *   get:
 *     tags:
 *       - Algemeen
 *     summary: Health Check
 *     description: Controleert of de API actief is en geeft systeeminformatie
 *     responses:
 *       200:
 *         description: API is operationeel
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconden
 *                 environment:
 *                   type: string
 *                 nodeVersion:
 *                   type: string
 */
router.get('/health', (req, res) => {
  const healthInfo = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  };
  
  console.log('[HEALTH] Health check aangeroepen');
  console.log('[HEALTH]    Status:', healthInfo.status);
  console.log('[HEALTH]    Uptime:', Math.round(healthInfo.uptime), 'seconden');
  console.log('[HEALTH]    Memory:', healthInfo.memory.used, '/', healthInfo.memory.total);
  
  res.json(healthInfo);
});

/**
 * @swagger
 * /debug/swagger:
 *   get:
 *     tags:
 *       - Algemeen
 *     summary: Swagger Debug Info
 *     description: Toont debug informatie over de Swagger configuratie (alleen in development)
 *     responses:
 *       200:
 *         description: Debug informatie
 *       403:
 *         description: Alleen beschikbaar in development mode
 */
router.get('/debug/swagger', (req, res) => {
  console.log('[DEBUG] Swagger debug info aangeroepen');
  
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Debug endpoints zijn niet beschikbaar in productie'
    });
  }
  
  try {
    const swaggerSpec = require('../config/swagger');
    
    const debugInfo = {
      openapi: swaggerSpec.openapi,
      title: swaggerSpec.info.title,
      version: swaggerSpec.info.version,
      totalEndpoints: Object.keys(swaggerSpec.paths || {}).length,
      endpoints: Object.keys(swaggerSpec.paths || {}),
      tags: swaggerSpec.tags?.map(t => t.name) || [],
      servers: swaggerSpec.servers,
      componentsSchemas: Object.keys(swaggerSpec.components?.schemas || {}),
      securitySchemes: Object.keys(swaggerSpec.components?.securitySchemes || {})
    };
    
    console.log('[SUCCESS] [DEBUG] Swagger info verstuurd');
    console.log('[DEBUG]    Endpoints:', debugInfo.totalEndpoints);
    
    res.json({
      success: true,
      data: debugInfo,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ERROR] [DEBUG] Fout bij ophalen swagger info:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen swagger info',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /debug/versions:
 *   get:
 *     tags:
 *       - Algemeen
 *     summary: Package Versies
 *     description: Toont versies van alle belangrijke packages
 *     responses:
 *       200:
 *         description: Package versie informatie
 */
router.get('/debug/versions', (req, res) => {
  console.log('[DEBUG] Package versions aangeroepen');
  
  try {
    const packageJson = require('../../package.json');
    const swaggerUiExpressVersion = packageJson.dependencies['swagger-ui-express'];
    const swaggerJsdocVersion = packageJson.dependencies['swagger-jsdoc'];
    
    const versions = {
      api: packageJson.version,
      node: process.version,
      packages: {
        'express': packageJson.dependencies['express'],
        'swagger-ui-express': swaggerUiExpressVersion,
        'swagger-jsdoc': swaggerJsdocVersion,
        'pg': packageJson.dependencies['pg'],
        'jsonwebtoken': packageJson.dependencies['jsonwebtoken']
      },
      environment: process.env.NODE_ENV || 'development'
    };
    
    console.log('[DEBUG] Versie info:', JSON.stringify(versions, null, 2));
    
    res.json({
      success: true,
      data: versions,
      note: 'Deze API gebruikt swagger-ui-express bundled versie (geen externe CDN)'
    });
  } catch (error) {
    console.error('[ERROR] [DEBUG] Fout bij ophalen versies:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen versie info',
      error: error.message
    });
  }
});

module.exports = router;
