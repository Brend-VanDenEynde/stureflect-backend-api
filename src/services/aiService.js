const axios = require('axios');

/**
 * OpenAI API configuratie
 */
const OPENAI_API_BASE = 'https://api.openai.com/v1';
const OPENAI_MODEL = 'gpt-5-mini'; // GPT-5 mini model
const OPENAI_TIMEOUT = 120000; // 120s timeout voor Dokploy

/**
 * Feedback categorieën die we van de AI verwachten
 */
const FEEDBACK_TYPES = [
  'code_quality',
  'best_practices',
  'security',
  'performance',
  'maintainability',
  'documentation',
  'error_handling',
  'naming',
  'structure'
];

/**
 * Severity mapping
 */
const SEVERITY_MAP = {
  'critical': 'critical',
  'high': 'high',
  'medium': 'medium',
  'low': 'low',
  'info': 'low',
  'suggestion': 'low'
};

/**
 * Bouw de system prompt voor code analyse
 * @param {object} courseSettings - Course settings met rubric en guidelines
 * @returns {string}
 */
function buildSystemPrompt(courseSettings) {
  let prompt = `Je bent een ervaren code reviewer en programmeer docent. Je analyseert code van studenten en geeft constructieve, educatieve feedback.

Je feedback moet:
- Specifiek en actionable zijn
- Uitleggen WAAROM iets beter kan (educatief)
- Concrete verbetervoorstellen bevatten
- Geschikt zijn voor studenten die nog leren
- In het Nederlands zijn

Je geeft feedback in de volgende categorieën:
- code_quality: Algemene codekwaliteit
- best_practices: Best practices en conventies
- security: Beveiligingsissues
- performance: Performance problemen
- maintainability: Onderhoudbaarheid
- documentation: Documentatie en comments
- error_handling: Foutafhandeling
- naming: Naamgeving van variabelen, functies, etc.
- structure: Code structuur en organisatie

Voor elke feedback item geef je:
- type: De categorie (zie boven)
- severity: critical, high, medium, of low
- line_number: Het regelnummer waar de feedback over gaat (indien van toepassing)
- content: De feedback tekst (wat is het probleem)
- suggestion: Een concrete verbetersuggestie`;

  // Voeg course-specifieke rubric toe indien beschikbaar
  if (courseSettings?.rubric) {
    prompt += `\n\nBEOORDELINGSRUBRIC VOOR DEZE CURSUS:
${courseSettings.rubric}

Gebruik deze rubric als leidraad bij het beoordelen van de code.`;
  }

  // Voeg AI guidelines toe indien beschikbaar
  if (courseSettings?.ai_guidelines) {
    prompt += `\n\nSPECIFIEKE INSTRUCTIES VOOR DEZE CURSUS:
${courseSettings.ai_guidelines}`;
  }

  prompt += `\n\nRESPONS FORMAT:
Geef je feedback als een JSON array met objecten. Voorbeeld:
[
  {
    "type": "naming",
    "severity": "low",
    "line_number": 5,
    "content": "De variabele naam 'x' is niet descriptief.",
    "suggestion": "Gebruik een beschrijvende naam zoals 'userCount' of 'totalItems'."
  },
  {
    "type": "error_handling",
    "severity": "high",
    "line_number": 12,
    "content": "Deze async functie heeft geen try-catch block.",
    "suggestion": "Wrap de code in een try-catch block om errors correct af te handelen."
  }
]

BELANGRIJK:
- Geef ALLEEN de JSON array terug, geen andere tekst
- Als de code goed is en geen feedback nodig heeft, geef een lege array: []
- Focus op de belangrijkste verbeterpunten (max 10 items per bestand)
- Wees constructief, niet negatief`;

  return prompt;
}

/**
 * Bouw de user prompt voor een specifiek bestand
 * @param {string} filePath - Bestandspad
 * @param {string} content - Bestandsinhoud
 * @param {string} language - Programmeertaal
 * @returns {string}
 */
function buildUserPrompt(filePath, content, language) {
  return `Analyseer het volgende ${language} bestand en geef feedback:

BESTAND: ${filePath}
TAAL: ${language}

CODE:
\`\`\`${language}
${content}
\`\`\`

Geef je feedback als JSON array.`;
}

/**
 * Maak OpenAI API headers
 * @returns {object}
 */
function getOpenAIHeaders() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is niet geconfigureerd');
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
}

/**
 * Analyseer een enkel bestand met OpenAI
 * @param {string} filePath - Bestandspad
 * @param {string} content - Bestandsinhoud
 * @param {string} language - Programmeertaal
 * @param {object} courseSettings - Course settings
 * @returns {Promise<Array>} - Array van feedback items
 */
async function analyzeFile(filePath, content, language, courseSettings) {
  try {
    const systemPrompt = buildSystemPrompt(courseSettings);
    const userPrompt = buildUserPrompt(filePath, content, language);

    const response = await axios.post(
      `${OPENAI_API_BASE}/chat/completions`,
      {
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Lage temperature voor consistente output
        max_tokens: 2000
      },
      {
        headers: getOpenAIHeaders(),
        timeout: OPENAI_TIMEOUT
      }
    );

    const aiResponse = response.data.choices[0]?.message?.content;

    if (!aiResponse) {
      console.warn(`[API] AI: No response for ${filePath}`);
      return [];
    }

    // Parse JSON response
    const feedbackItems = parseAIResponse(aiResponse, filePath);

    return feedbackItems;
  } catch (error) {
    console.error(`[API] AI error analyzing ${filePath}:`, error.message);

    if (error.response) {
      console.error('[API] AI error status:', error.response.status);
      console.error('[API] AI error data:', JSON.stringify(error.response.data));
    }

    // Return lege array bij fout, niet crashen
    return [];
  }
}

/**
 * Parse de AI response en valideer de feedback items
 * @param {string} response - Raw AI response
 * @param {string} filePath - Bestandspad voor context
 * @returns {Array}
 */
function parseAIResponse(response, filePath) {
  try {
    // Probeer JSON te extracten uit de response
    let jsonStr = response.trim();

    // Als response in markdown code block zit, extract de JSON
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      console.warn(`[API] AI: Response is not an array for ${filePath}`);
      return [];
    }

    // Valideer en normaliseer elk feedback item
    return parsed
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        file_path: filePath,
        type: FEEDBACK_TYPES.includes(item.type) ? item.type : 'code_quality',
        severity: SEVERITY_MAP[item.severity?.toLowerCase()] || 'low',
        line_number: typeof item.line_number === 'number' ? item.line_number : null,
        content: String(item.content || 'Geen details beschikbaar'),
        suggestion: item.suggestion ? String(item.suggestion) : null
      }))
      .slice(0, 10); // Max 10 items per bestand
  } catch (parseError) {
    console.warn(`[API] AI: Could not parse response for ${filePath}:`, parseError.message);
    console.warn(`[API] AI: Raw response:`, response.substring(0, 500));
    return [];
  }
}

/**
 * Analyseer meerdere bestanden
 * @param {Array<{path: string, content: string, language: string}>} files - Bestanden om te analyseren
 * @param {object} courseSettings - Course settings
 * @returns {Promise<{success: boolean, feedback: Array, summary: object}>}
 */
async function analyzeFiles(files, courseSettings) {
  const allFeedback = [];
  const summary = {
    files_analyzed: 0,
    total_feedback: 0,
    by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
    by_type: {}
  };

  console.log(`[API] AI: Starting analysis of ${files.length} files`);

  for (const file of files) {
    if (!file.content) {
      console.log(`[API] AI: Skip ${file.path} - no content`);
      continue;
    }

    console.log(`[API] AI: Analyzing ${file.path} (${file.language})`);

    const feedback = await analyzeFile(
      file.path,
      file.content,
      file.language || 'unknown',
      courseSettings
    );

    allFeedback.push(...feedback);
    summary.files_analyzed++;
    summary.total_feedback += feedback.length;

    // Update summary statistics
    for (const item of feedback) {
      summary.by_severity[item.severity] = (summary.by_severity[item.severity] || 0) + 1;
      summary.by_type[item.type] = (summary.by_type[item.type] || 0) + 1;
    }

    // Kleine delay tussen API calls om rate limiting te voorkomen
    if (files.indexOf(file) < files.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`[API] AI: Analysis complete - ${summary.files_analyzed} files, ${summary.total_feedback} feedback items`);

  return {
    success: true,
    feedback: allFeedback,
    summary
  };
}

/**
 * Bereken een score op basis van feedback
 * @param {Array} feedback - Feedback items
 * @returns {number} - Score tussen 0 en 100
 */
function calculateScore(feedback) {
  if (!feedback || feedback.length === 0) {
    return 100; // Geen feedback = perfecte score
  }

  // Strafpunten per severity
  const penalties = {
    critical: 20,
    high: 10,
    medium: 5,
    low: 2
  };

  let totalPenalty = 0;
  for (const item of feedback) {
    totalPenalty += penalties[item.severity] || 2;
  }

  // Score berekenen (max 100, min 0)
  const score = Math.max(0, Math.min(100, 100 - totalPenalty));

  return Math.round(score);
}

/**
 * Log AI analyse event
 * @param {string} action - Actie
 * @param {string} details - Details
 */
function logAIEvent(action, details) {
  const timestamp = new Date().toISOString();
  console.log(`[API] AI ${timestamp} | ${action} | ${details}`);
}

module.exports = {
  analyzeFile,
  analyzeFiles,
  calculateScore,
  parseAIResponse,
  buildSystemPrompt,
  buildUserPrompt,
  logAIEvent,
  FEEDBACK_TYPES,
  SEVERITY_MAP,
  OPENAI_MODEL,
  OPENAI_TIMEOUT
};
