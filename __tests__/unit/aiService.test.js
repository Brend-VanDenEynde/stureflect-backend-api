/**
 * Unit tests for aiService
 * Tests prompt building, response parsing, and score calculation
 */

const axios = require('axios');

// Mock axios before importing
jest.mock('axios');

const {
  buildSystemPrompt,
  buildUserPrompt,
  parseAIResponse,
  calculateScore,
  analyzeFile,
  analyzeFiles,
  FEEDBACK_TYPES,
  SEVERITY_MAP,
  OPENAI_MODEL
} = require('../../src/services/aiService');

describe('aiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up environment variable for tests
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  // ==========================================
  // buildSystemPrompt - Pure function tests
  // ==========================================
  describe('buildSystemPrompt', () => {
    it('should build base prompt without course settings', () => {
      const prompt = buildSystemPrompt({});

      expect(prompt).toContain('code reviewer');
      expect(prompt).toContain('constructieve, educatieve feedback');
      expect(prompt).toContain('code_quality');
      expect(prompt).toContain('best_practices');
      expect(prompt).toContain('security');
      expect(prompt).toContain('JSON array');
    });

    it('should include rubric when provided', () => {
      const prompt = buildSystemPrompt({
        rubric: 'Code moet goed gedocumenteerd zijn'
      });

      expect(prompt).toContain('BEOORDELINGSRUBRIC VOOR DEZE CURSUS');
      expect(prompt).toContain('Code moet goed gedocumenteerd zijn');
    });

    it('should include AI guidelines when provided', () => {
      const prompt = buildSystemPrompt({
        ai_guidelines: 'Focus op best practices'
      });

      expect(prompt).toContain('SPECIFIEKE INSTRUCTIES VOOR DEZE CURSUS');
      expect(prompt).toContain('Focus op best practices');
    });

    it('should include both rubric and guidelines', () => {
      const prompt = buildSystemPrompt({
        rubric: 'Rubric content',
        ai_guidelines: 'Guidelines content'
      });

      expect(prompt).toContain('Rubric content');
      expect(prompt).toContain('Guidelines content');
    });

    it('should handle null course settings', () => {
      const prompt = buildSystemPrompt(null);
      expect(prompt).toContain('code reviewer');
    });

    it('should handle undefined course settings', () => {
      const prompt = buildSystemPrompt(undefined);
      expect(prompt).toContain('code reviewer');
    });
  });

  // ==========================================
  // buildUserPrompt - Pure function tests
  // ==========================================
  describe('buildUserPrompt', () => {
    it('should build prompt with file info', () => {
      const prompt = buildUserPrompt('src/app.js', 'console.log("test");', 'javascript');

      expect(prompt).toContain('BESTAND: src/app.js');
      expect(prompt).toContain('TAAL: javascript');
      expect(prompt).toContain('console.log("test");');
      expect(prompt).toContain('```javascript');
    });

    it('should handle Python files', () => {
      const prompt = buildUserPrompt('main.py', 'print("hello")', 'python');

      expect(prompt).toContain('BESTAND: main.py');
      expect(prompt).toContain('TAAL: python');
      expect(prompt).toContain('```python');
    });

    it('should handle empty content', () => {
      const prompt = buildUserPrompt('empty.js', '', 'javascript');

      expect(prompt).toContain('BESTAND: empty.js');
      expect(prompt).toContain('```javascript');
    });
  });

  // ==========================================
  // parseAIResponse - Pure function tests
  // ==========================================
  describe('parseAIResponse', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify([
        {
          type: 'code_quality',
          severity: 'high',
          line_number: 5,
          content: 'Missing error handling',
          suggestion: 'Add try-catch'
        }
      ]);

      const result = parseAIResponse(response, 'test.js');

      expect(result).toHaveLength(1);
      expect(result[0].file_path).toBe('test.js');
      expect(result[0].type).toBe('code_quality');
      expect(result[0].severity).toBe('high');
      expect(result[0].line_number).toBe(5);
    });

    it('should parse JSON in markdown code block', () => {
      const response = '```json\n[{"type": "naming", "severity": "low", "content": "Bad name"}]\n```';

      const result = parseAIResponse(response, 'test.js');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('naming');
    });

    it('should parse JSON in code block without language', () => {
      const response = '```\n[{"type": "security", "severity": "critical", "content": "SQL injection"}]\n```';

      const result = parseAIResponse(response, 'test.js');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('security');
      expect(result[0].severity).toBe('critical');
    });

    it('should normalize unknown feedback types to code_quality', () => {
      const response = JSON.stringify([
        { type: 'unknown_type', severity: 'medium', content: 'Test' }
      ]);

      const result = parseAIResponse(response, 'test.js');

      expect(result[0].type).toBe('code_quality');
    });

    it('should normalize severity levels', () => {
      const response = JSON.stringify([
        { type: 'naming', severity: 'info', content: 'Test' },
        { type: 'naming', severity: 'suggestion', content: 'Test2' },
        { type: 'naming', severity: 'CRITICAL', content: 'Test3' }
      ]);

      const result = parseAIResponse(response, 'test.js');

      expect(result[0].severity).toBe('low');
      expect(result[1].severity).toBe('low');
      expect(result[2].severity).toBe('critical');
    });

    it('should default unknown severity to low', () => {
      const response = JSON.stringify([
        { type: 'naming', severity: 'unknown', content: 'Test' }
      ]);

      const result = parseAIResponse(response, 'test.js');

      expect(result[0].severity).toBe('low');
    });

    it('should handle null line_number', () => {
      const response = JSON.stringify([
        { type: 'naming', severity: 'low', line_number: null, content: 'Test' }
      ]);

      const result = parseAIResponse(response, 'test.js');

      expect(result[0].line_number).toBeNull();
    });

    it('should handle string line_number (convert to null)', () => {
      const response = JSON.stringify([
        { type: 'naming', severity: 'low', line_number: 'line 5', content: 'Test' }
      ]);

      const result = parseAIResponse(response, 'test.js');

      expect(result[0].line_number).toBeNull();
    });

    it('should handle missing suggestion', () => {
      const response = JSON.stringify([
        { type: 'naming', severity: 'low', content: 'Test' }
      ]);

      const result = parseAIResponse(response, 'test.js');

      expect(result[0].suggestion).toBeNull();
    });

    it('should limit to 10 items per file', () => {
      const items = Array.from({ length: 15 }, (_, i) => ({
        type: 'naming',
        severity: 'low',
        content: `Item ${i}`
      }));
      const response = JSON.stringify(items);

      const result = parseAIResponse(response, 'test.js');

      expect(result).toHaveLength(10);
    });

    it('should return empty array for invalid JSON', () => {
      const result = parseAIResponse('not valid json', 'test.js');

      expect(result).toEqual([]);
    });

    it('should return empty array for non-array JSON', () => {
      const result = parseAIResponse('{"type": "object"}', 'test.js');

      expect(result).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      const result = parseAIResponse('', 'test.js');

      expect(result).toEqual([]);
    });

    it('should filter out null items', () => {
      const response = JSON.stringify([
        null,
        { type: 'naming', severity: 'low', content: 'Valid' },
        undefined,
        { type: 'security', severity: 'high', content: 'Also valid' }
      ]);

      const result = parseAIResponse(response, 'test.js');

      expect(result).toHaveLength(2);
    });

    it('should provide default content if missing', () => {
      const response = JSON.stringify([
        { type: 'naming', severity: 'low' }
      ]);

      const result = parseAIResponse(response, 'test.js');

      expect(result[0].content).toBe('Geen details beschikbaar');
    });

    it('should convert content to string', () => {
      const response = JSON.stringify([
        { type: 'naming', severity: 'low', content: 12345 }
      ]);

      const result = parseAIResponse(response, 'test.js');

      expect(result[0].content).toBe('12345');
    });
  });

  // ==========================================
  // calculateScore - Pure function tests
  // ==========================================
  describe('calculateScore', () => {
    it('should return 100 for empty feedback', () => {
      expect(calculateScore([])).toBe(100);
    });

    it('should return 100 for null feedback', () => {
      expect(calculateScore(null)).toBe(100);
    });

    it('should return 100 for undefined feedback', () => {
      expect(calculateScore(undefined)).toBe(100);
    });

    it('should deduct 20 points for critical', () => {
      const feedback = [{ severity: 'critical' }];
      expect(calculateScore(feedback)).toBe(80);
    });

    it('should deduct 10 points for high', () => {
      const feedback = [{ severity: 'high' }];
      expect(calculateScore(feedback)).toBe(90);
    });

    it('should deduct 5 points for medium', () => {
      const feedback = [{ severity: 'medium' }];
      expect(calculateScore(feedback)).toBe(95);
    });

    it('should deduct 2 points for low', () => {
      const feedback = [{ severity: 'low' }];
      expect(calculateScore(feedback)).toBe(98);
    });

    it('should calculate cumulative penalties', () => {
      const feedback = [
        { severity: 'critical' },  // -20
        { severity: 'high' },      // -10
        { severity: 'medium' },    // -5
        { severity: 'low' }        // -2
      ];
      expect(calculateScore(feedback)).toBe(63); // 100 - 37
    });

    it('should not go below 0', () => {
      const feedback = Array.from({ length: 10 }, () => ({ severity: 'critical' }));
      expect(calculateScore(feedback)).toBe(0);
    });

    it('should not exceed 100', () => {
      expect(calculateScore([])).toBe(100);
    });

    it('should handle unknown severity as low (2 points)', () => {
      const feedback = [{ severity: 'unknown' }];
      expect(calculateScore(feedback)).toBe(98);
    });

    it('should handle missing severity as low', () => {
      const feedback = [{}];
      expect(calculateScore(feedback)).toBe(98);
    });

    it('should round score to integer', () => {
      // With standard penalties, scores should always be integers
      const feedback = [{ severity: 'low' }, { severity: 'low' }, { severity: 'low' }];
      const score = calculateScore(feedback);
      expect(Number.isInteger(score)).toBe(true);
    });
  });

  // ==========================================
  // analyzeFile - Mocked API tests
  // ==========================================
  describe('analyzeFile', () => {
    it('should analyze file and return feedback', async () => {
      const mockFeedback = [
        { type: 'naming', severity: 'low', content: 'Consider better naming' }
      ];

      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: { content: JSON.stringify(mockFeedback) }
          }]
        }
      });

      const result = await analyzeFile('test.js', 'const x = 1;', 'javascript', {});

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('naming');
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('openai.com'),
        expect.objectContaining({
          model: OPENAI_MODEL,
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' })
          ])
        }),
        expect.any(Object)
      );
    });

    it('should return empty array on API error', async () => {
      axios.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await analyzeFile('test.js', 'code', 'javascript', {});

      expect(result).toEqual([]);
    });

    it('should return empty array when no response content', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: null } }]
        }
      });

      const result = await analyzeFile('test.js', 'code', 'javascript', {});

      expect(result).toEqual([]);
    });

    it('should return empty array for empty choices', async () => {
      axios.post.mockResolvedValueOnce({
        data: { choices: [] }
      });

      const result = await analyzeFile('test.js', 'code', 'javascript', {});

      expect(result).toEqual([]);
    });

    it('should include course settings in prompt', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: '[]' } }]
        }
      });

      await analyzeFile('test.js', 'code', 'javascript', {
        rubric: 'Test rubric',
        ai_guidelines: 'Test guidelines'
      });

      const callArgs = axios.post.mock.calls[0];
      const systemMessage = callArgs[1].messages.find(m => m.role === 'system');

      expect(systemMessage.content).toContain('Test rubric');
      expect(systemMessage.content).toContain('Test guidelines');
    });
  });

  // ==========================================
  // analyzeFiles - Mocked API tests
  // ==========================================
  describe('analyzeFiles', () => {
    it('should analyze multiple files', async () => {
      // Mock two successful responses
      axios.post
        .mockResolvedValueOnce({
          data: {
            choices: [{
              message: {
                content: JSON.stringify([
                  { type: 'naming', severity: 'low', content: 'Feedback 1' }
                ])
              }
            }]
          }
        })
        .mockResolvedValueOnce({
          data: {
            choices: [{
              message: {
                content: JSON.stringify([
                  { type: 'security', severity: 'high', content: 'Feedback 2' }
                ])
              }
            }]
          }
        });

      const files = [
        { path: 'file1.js', content: 'const a = 1;', language: 'javascript' },
        { path: 'file2.js', content: 'const b = 2;', language: 'javascript' }
      ];

      const result = await analyzeFiles(files, {});

      expect(result.success).toBe(true);
      expect(result.feedback).toHaveLength(2);
      expect(result.summary.files_analyzed).toBe(2);
      expect(result.summary.total_feedback).toBe(2);
      expect(result.summary.by_severity.low).toBe(1);
      expect(result.summary.by_severity.high).toBe(1);
    });

    it('should skip files without content', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: { content: '[]' }
          }]
        }
      });

      const files = [
        { path: 'file1.js', content: null, language: 'javascript' },
        { path: 'file2.js', content: 'const a = 1;', language: 'javascript' }
      ];

      const result = await analyzeFiles(files, {});

      expect(result.summary.files_analyzed).toBe(1);
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('should handle empty files array', async () => {
      const result = await analyzeFiles([], {});

      expect(result.success).toBe(true);
      expect(result.feedback).toEqual([]);
      expect(result.summary.files_analyzed).toBe(0);
    });

    it('should aggregate feedback by type', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: {
              content: JSON.stringify([
                { type: 'naming', severity: 'low', content: 'Test 1' },
                { type: 'naming', severity: 'medium', content: 'Test 2' },
                { type: 'security', severity: 'high', content: 'Test 3' }
              ])
            }
          }]
        }
      });

      const files = [
        { path: 'file.js', content: 'code', language: 'javascript' }
      ];

      const result = await analyzeFiles(files, {});

      expect(result.summary.by_type.naming).toBe(2);
      expect(result.summary.by_type.security).toBe(1);
    });

    it('should continue on individual file errors', async () => {
      axios.post
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({
          data: {
            choices: [{
              message: {
                content: JSON.stringify([
                  { type: 'naming', severity: 'low', content: 'Feedback' }
                ])
              }
            }]
          }
        });

      const files = [
        { path: 'file1.js', content: 'code1', language: 'javascript' },
        { path: 'file2.js', content: 'code2', language: 'javascript' }
      ];

      const result = await analyzeFiles(files, {});

      expect(result.success).toBe(true);
      expect(result.summary.files_analyzed).toBe(2); // Both counted
      expect(result.feedback).toHaveLength(1); // Only successful one has feedback
    });
  });

  // ==========================================
  // Constants validation
  // ==========================================
  describe('Constants', () => {
    it('should have all expected feedback types', () => {
      expect(FEEDBACK_TYPES).toContain('code_quality');
      expect(FEEDBACK_TYPES).toContain('best_practices');
      expect(FEEDBACK_TYPES).toContain('security');
      expect(FEEDBACK_TYPES).toContain('performance');
      expect(FEEDBACK_TYPES).toContain('maintainability');
      expect(FEEDBACK_TYPES).toContain('documentation');
      expect(FEEDBACK_TYPES).toContain('error_handling');
      expect(FEEDBACK_TYPES).toContain('naming');
      expect(FEEDBACK_TYPES).toContain('structure');
    });

    it('should have correct severity mappings', () => {
      expect(SEVERITY_MAP.critical).toBe('critical');
      expect(SEVERITY_MAP.high).toBe('high');
      expect(SEVERITY_MAP.medium).toBe('medium');
      expect(SEVERITY_MAP.low).toBe('low');
      expect(SEVERITY_MAP.info).toBe('low');
      expect(SEVERITY_MAP.suggestion).toBe('low');
    });

    it('should use GPT-5 mini model', () => {
      expect(OPENAI_MODEL).toBe('gpt-5-mini');
    });
  });
});
