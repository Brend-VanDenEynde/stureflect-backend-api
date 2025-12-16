/**
 * Unit tests for githubService
 * Tests pure functions without external dependencies
 * and API functions with mocked axios
 */

const axios = require('axios');

// Mock axios before importing the service
jest.mock('axios');

const {
  parseGitHubUrl,
  validateGitHubUrl,
  filterCodeFiles,
  detectLanguage,
  checkRepositoryAccess,
  getLatestCommitSha,
  getRepositoryTree,
  getCommitFiles,
  getFileContent,
  registerWebhook,
  CODE_EXTENSIONS,
  EXCLUDED_PATHS
} = require('../../src/services/githubService');

describe('githubService', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // parseGitHubUrl - Pure function tests
  // ==========================================
  describe('parseGitHubUrl', () => {
    it('should parse standard https URL', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse URL with trailing slash', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo/');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse URL with .git suffix', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo.git');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse URL without https prefix', () => {
      const result = parseGitHubUrl('github.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse URL with www prefix', () => {
      const result = parseGitHubUrl('https://www.github.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse http URL', () => {
      const result = parseGitHubUrl('http://github.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should handle owner/repo with hyphens and underscores', () => {
      const result = parseGitHubUrl('https://github.com/my-org/my_repo-name');
      expect(result).toEqual({ owner: 'my-org', repo: 'my_repo-name' });
    });

    it('should handle owner/repo with dots', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo.js');
      expect(result).toEqual({ owner: 'owner', repo: 'repo.js' });
    });

    it('should return null for invalid URL', () => {
      expect(parseGitHubUrl('not-a-url')).toBeNull();
    });

    it('should return null for non-GitHub URL', () => {
      expect(parseGitHubUrl('https://gitlab.com/owner/repo')).toBeNull();
    });

    it('should return null for null input', () => {
      expect(parseGitHubUrl(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(parseGitHubUrl(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseGitHubUrl('')).toBeNull();
    });

    it('should return null for number input', () => {
      expect(parseGitHubUrl(123)).toBeNull();
    });

    it('should return null for GitHub URL without repo', () => {
      expect(parseGitHubUrl('https://github.com/owner')).toBeNull();
    });

    it('should return null for GitHub URL with extra path segments', () => {
      // This should fail as it has extra segments
      expect(parseGitHubUrl('https://github.com/owner/repo/tree/main')).toBeNull();
    });
  });

  // ==========================================
  // validateGitHubUrl - Pure function tests
  // ==========================================
  describe('validateGitHubUrl', () => {
    it('should validate correct GitHub URL', () => {
      const result = validateGitHubUrl('https://github.com/owner/repo');
      expect(result).toEqual({
        valid: true,
        owner: 'owner',
        repo: 'repo'
      });
    });

    it('should reject null URL', () => {
      const result = validateGitHubUrl(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('GitHub URL is verplicht');
    });

    it('should reject non-string URL', () => {
      const result = validateGitHubUrl(123);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('GitHub URL moet een string zijn');
    });

    it('should reject empty string', () => {
      const result = validateGitHubUrl('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('GitHub URL mag niet leeg zijn');
    });

    it('should reject non-GitHub URL', () => {
      const result = validateGitHubUrl('https://gitlab.com/owner/repo');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL moet een GitHub repository zijn');
    });

    it('should reject invalid GitHub URL format', () => {
      const result = validateGitHubUrl('https://github.com/only-owner');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Ongeldige GitHub URL format');
    });

    it('should reject owner starting with dash', () => {
      const result = validateGitHubUrl('https://github.com/-owner/repo');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('mogen niet beginnen met een streepje');
    });

    it('should reject repo starting with dash', () => {
      const result = validateGitHubUrl('https://github.com/owner/-repo');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('mogen niet beginnen met een streepje');
    });

    it('should trim whitespace from URL', () => {
      const result = validateGitHubUrl('  https://github.com/owner/repo  ');
      expect(result.valid).toBe(true);
      expect(result.owner).toBe('owner');
    });
  });

  // ==========================================
  // filterCodeFiles - Pure function tests
  // ==========================================
  describe('filterCodeFiles', () => {
    it('should filter JavaScript files', () => {
      const files = [
        { path: 'src/index.js' },
        { path: 'src/app.ts' },
        { path: 'README.md' }
      ];
      const result = filterCodeFiles(files);
      expect(result).toHaveLength(3);
    });

    it('should exclude node_modules', () => {
      const files = [
        { path: 'src/index.js' },
        { path: 'node_modules/express/index.js' }
      ];
      const result = filterCodeFiles(files);
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('src/index.js');
    });

    it('should exclude .git directory', () => {
      const files = [
        { path: 'src/index.js' },
        { path: '.git/config' }
      ];
      const result = filterCodeFiles(files);
      expect(result).toHaveLength(1);
    });

    it('should exclude vendor directory', () => {
      const files = [
        { path: 'src/index.php' },
        { path: 'vendor/autoload.php' }
      ];
      const result = filterCodeFiles(files);
      expect(result).toHaveLength(1);
    });

    it('should exclude package-lock.json', () => {
      const files = [
        { path: 'package.json' },
        { path: 'package-lock.json' }
      ];
      const result = filterCodeFiles(files);
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('package.json');
    });

    it('should exclude .env files', () => {
      const files = [
        { path: 'src/config.js' },
        { path: '.env' },
        { path: '.env.local' }
      ];
      const result = filterCodeFiles(files);
      expect(result).toHaveLength(1);
    });

    it('should include various code extensions', () => {
      const files = [
        { path: 'app.js' },
        { path: 'app.py' },
        { path: 'App.java' },
        { path: 'main.go' },
        { path: 'lib.rs' },
        { path: 'style.css' },
        { path: 'index.html' }
      ];
      const result = filterCodeFiles(files);
      expect(result).toHaveLength(7);
    });

    it('should exclude non-code files', () => {
      const files = [
        { path: 'image.png' },
        { path: 'document.pdf' },
        { path: 'archive.zip' }
      ];
      const result = filterCodeFiles(files);
      expect(result).toHaveLength(0);
    });

    it('should handle empty array', () => {
      expect(filterCodeFiles([])).toEqual([]);
    });

    it('should handle non-array input', () => {
      expect(filterCodeFiles(null)).toEqual([]);
      expect(filterCodeFiles(undefined)).toEqual([]);
      expect(filterCodeFiles('string')).toEqual([]);
    });

    it('should handle files with null/undefined paths', () => {
      const files = [
        { path: 'valid.js' },
        { path: null },
        { path: undefined },
        {}
      ];
      const result = filterCodeFiles(files);
      expect(result).toHaveLength(1);
    });

    it('should exclude dist and build directories', () => {
      const files = [
        { path: 'src/index.js' },
        { path: 'dist/bundle.js' },
        { path: 'build/output.js' }
      ];
      const result = filterCodeFiles(files);
      expect(result).toHaveLength(1);
    });

    it('should exclude __pycache__ directory', () => {
      const files = [
        { path: 'app.py' },
        { path: '__pycache__/app.cpython-39.pyc' }
      ];
      const result = filterCodeFiles(files);
      expect(result).toHaveLength(1);
    });
  });

  // ==========================================
  // detectLanguage - Pure function tests
  // ==========================================
  describe('detectLanguage', () => {
    it('should detect JavaScript', () => {
      expect(detectLanguage('app.js')).toBe('javascript');
      expect(detectLanguage('component.jsx')).toBe('javascript');
      expect(detectLanguage('module.mjs')).toBe('javascript');
      expect(detectLanguage('config.cjs')).toBe('javascript');
    });

    it('should detect TypeScript', () => {
      expect(detectLanguage('app.ts')).toBe('typescript');
      expect(detectLanguage('component.tsx')).toBe('typescript');
    });

    it('should detect Python', () => {
      expect(detectLanguage('script.py')).toBe('python');
      expect(detectLanguage('gui.pyw')).toBe('python');
    });

    it('should detect Java', () => {
      expect(detectLanguage('Main.java')).toBe('java');
    });

    it('should detect Kotlin', () => {
      expect(detectLanguage('App.kt')).toBe('kotlin');
      expect(detectLanguage('build.gradle.kts')).toBe('kotlin');
    });

    it('should detect C/C++', () => {
      expect(detectLanguage('main.c')).toBe('c');
      expect(detectLanguage('header.h')).toBe('c');
      expect(detectLanguage('app.cpp')).toBe('cpp');
      expect(detectLanguage('lib.hpp')).toBe('cpp');
    });

    it('should detect Go', () => {
      expect(detectLanguage('main.go')).toBe('go');
    });

    it('should detect Rust', () => {
      expect(detectLanguage('lib.rs')).toBe('rust');
    });

    it('should detect web technologies', () => {
      expect(detectLanguage('index.html')).toBe('html');
      expect(detectLanguage('style.css')).toBe('css');
      expect(detectLanguage('style.scss')).toBe('scss');
      expect(detectLanguage('App.vue')).toBe('vue');
      expect(detectLanguage('App.svelte')).toBe('svelte');
    });

    it('should detect config files', () => {
      expect(detectLanguage('config.json')).toBe('json');
      expect(detectLanguage('config.yaml')).toBe('yaml');
      expect(detectLanguage('config.yml')).toBe('yaml');
      expect(detectLanguage('config.toml')).toBe('toml');
    });

    it('should detect shell scripts', () => {
      expect(detectLanguage('script.sh')).toBe('shell');
      expect(detectLanguage('script.bash')).toBe('shell');
    });

    it('should detect SQL', () => {
      expect(detectLanguage('schema.sql')).toBe('sql');
    });

    it('should return unknown for unsupported extensions', () => {
      expect(detectLanguage('file.xyz')).toBe('unknown');
    });

    it('should return unknown for files without extension', () => {
      expect(detectLanguage('Makefile')).toBe('unknown');
      expect(detectLanguage('Dockerfile')).toBe('unknown');
    });

    it('should handle null/undefined input', () => {
      expect(detectLanguage(null)).toBe('unknown');
      expect(detectLanguage(undefined)).toBe('unknown');
    });

    it('should handle path with directories', () => {
      expect(detectLanguage('src/components/App.tsx')).toBe('typescript');
    });

    it('should be case insensitive', () => {
      expect(detectLanguage('App.JS')).toBe('javascript');
      expect(detectLanguage('Main.JAVA')).toBe('java');
    });
  });

  // ==========================================
  // checkRepositoryAccess - Mocked API tests
  // ==========================================
  describe('checkRepositoryAccess', () => {
    it('should return accessible true for valid repo', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          id: 123,
          name: 'test-repo',
          full_name: 'owner/test-repo',
          default_branch: 'main',
          private: false
        }
      });

      const result = await checkRepositoryAccess('owner', 'test-repo');

      expect(result.accessible).toBe(true);
      expect(result.repoData.name).toBe('test-repo');
      expect(result.repoData.default_branch).toBe('main');
    });

    it('should return REPO_NOT_FOUND for 404', async () => {
      axios.get.mockRejectedValueOnce({
        response: { status: 404 }
      });

      const result = await checkRepositoryAccess('owner', 'nonexistent');

      expect(result.accessible).toBe(false);
      expect(result.errorCode).toBe('REPO_NOT_FOUND');
    });

    it('should return RATE_LIMITED when rate limit exceeded', async () => {
      axios.get.mockRejectedValueOnce({
        response: {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0' }
        }
      });

      const result = await checkRepositoryAccess('owner', 'repo');

      expect(result.accessible).toBe(false);
      expect(result.errorCode).toBe('RATE_LIMITED');
    });

    it('should return FORBIDDEN for 403 without rate limit', async () => {
      axios.get.mockRejectedValueOnce({
        response: {
          status: 403,
          headers: { 'x-ratelimit-remaining': '100' }
        }
      });

      const result = await checkRepositoryAccess('owner', 'private-repo');

      expect(result.accessible).toBe(false);
      expect(result.errorCode).toBe('FORBIDDEN');
    });

    it('should return GITHUB_ERROR for network errors', async () => {
      axios.get.mockRejectedValueOnce(new Error('Network error'));

      const result = await checkRepositoryAccess('owner', 'repo');

      expect(result.accessible).toBe(false);
      expect(result.errorCode).toBe('GITHUB_ERROR');
    });
  });

  // ==========================================
  // getLatestCommitSha - Mocked API tests
  // ==========================================
  describe('getLatestCommitSha', () => {
    it('should return SHA for valid repo', async () => {
      axios.get.mockResolvedValueOnce({
        data: [{ sha: 'abc123def456' }]
      });

      const result = await getLatestCommitSha('owner', 'repo');

      expect(result.success).toBe(true);
      expect(result.sha).toBe('abc123def456');
    });

    it('should return EMPTY_REPO for repo without commits', async () => {
      axios.get.mockResolvedValueOnce({ data: [] });

      const result = await getLatestCommitSha('owner', 'empty-repo');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EMPTY_REPO');
    });

    it('should return EMPTY_REPO for 409 status', async () => {
      axios.get.mockRejectedValueOnce({
        response: { status: 409 }
      });

      const result = await getLatestCommitSha('owner', 'empty-repo');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EMPTY_REPO');
    });
  });

  // ==========================================
  // getRepositoryTree - Mocked API tests
  // ==========================================
  describe('getRepositoryTree', () => {
    it('should return files from tree', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          tree: [
            { type: 'blob', path: 'src/index.js', size: 100, sha: 'abc' },
            { type: 'blob', path: 'README.md', size: 50, sha: 'def' },
            { type: 'tree', path: 'src' } // Directory, should be filtered
          ],
          truncated: false
        }
      });

      const result = await getRepositoryTree('owner', 'repo', 'sha123');

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(2);
      expect(result.files[0].path).toBe('src/index.js');
      expect(result.truncated).toBe(false);
    });

    it('should indicate truncated results', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          tree: [{ type: 'blob', path: 'file.js', size: 100, sha: 'abc' }],
          truncated: true
        }
      });

      const result = await getRepositoryTree('owner', 'repo', 'sha123');

      expect(result.truncated).toBe(true);
    });

    it('should return NOT_FOUND for 404', async () => {
      axios.get.mockRejectedValueOnce({
        response: { status: 404 }
      });

      const result = await getRepositoryTree('owner', 'repo', 'invalid-sha');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
    });
  });

  // ==========================================
  // getCommitFiles - Mocked API tests
  // ==========================================
  describe('getCommitFiles', () => {
    it('should return files for a commit', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          sha: 'abc123',
          commit: {
            message: 'Test commit',
            author: { name: 'Test Author' }
          },
          files: [
            { filename: 'src/app.js', status: 'modified', additions: 10, deletions: 5, changes: 15 }
          ]
        }
      });

      const result = await getCommitFiles('owner', 'repo', 'abc123');

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('src/app.js');
      expect(result.files[0].status).toBe('modified');
      expect(result.commit.message).toBe('Test commit');
    });

    it('should return COMMIT_NOT_FOUND for 404', async () => {
      axios.get.mockRejectedValueOnce({
        response: { status: 404 }
      });

      const result = await getCommitFiles('owner', 'repo', 'invalid');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('COMMIT_NOT_FOUND');
    });
  });

  // ==========================================
  // getFileContent - Mocked API tests
  // ==========================================
  describe('getFileContent', () => {
    it('should return decoded file content', async () => {
      const content = 'console.log("Hello World");';
      const base64Content = Buffer.from(content).toString('base64');

      axios.get.mockResolvedValueOnce({
        data: {
          encoding: 'base64',
          content: base64Content,
          size: content.length,
          sha: 'abc123'
        }
      });

      const result = await getFileContent('owner', 'repo', 'src/index.js');

      expect(result.success).toBe(true);
      expect(result.content).toBe(content);
    });

    it('should return FILE_NOT_FOUND for 404', async () => {
      axios.get.mockRejectedValueOnce({
        response: { status: 404 }
      });

      const result = await getFileContent('owner', 'repo', 'nonexistent.js');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('FILE_NOT_FOUND');
    });

    it('should pass ref parameter when provided', async () => {
      const content = 'test';
      axios.get.mockResolvedValueOnce({
        data: {
          encoding: 'base64',
          content: Buffer.from(content).toString('base64'),
          size: content.length,
          sha: 'abc'
        }
      });

      await getFileContent('owner', 'repo', 'file.js', 'feature-branch');

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: { ref: 'feature-branch' }
        })
      );
    });
  });

  // ==========================================
  // registerWebhook - Mocked API tests
  // ==========================================
  describe('registerWebhook', () => {
    it('should register webhook successfully', async () => {
      axios.post.mockResolvedValueOnce({
        data: { id: 12345 }
      });

      const result = await registerWebhook(
        'owner',
        'repo',
        'https://api.example.com/webhook',
        'secret123',
        'user-token'
      );

      expect(result.success).toBe(true);
      expect(result.webhookId).toBe(12345);
    });

    it('should use user token when provided', async () => {
      axios.post.mockResolvedValueOnce({ data: { id: 123 } });

      await registerWebhook('owner', 'repo', 'https://api.example.com', 'secret', 'user-token');

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer user-token'
          })
        })
      );
    });

    it('should return REPO_NOT_FOUND for 404', async () => {
      axios.post.mockRejectedValueOnce({
        response: { status: 404 }
      });

      const result = await registerWebhook('owner', 'nonexistent', 'url', 'secret');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('REPO_NOT_FOUND');
    });

    it('should return FORBIDDEN for 403', async () => {
      axios.post.mockRejectedValueOnce({
        response: { status: 403 }
      });

      const result = await registerWebhook('owner', 'repo', 'url', 'secret');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('FORBIDDEN');
    });

    it('should return WEBHOOK_EXISTS for 422 with "already exists"', async () => {
      axios.post.mockRejectedValueOnce({
        response: {
          status: 422,
          data: {
            errors: [{ message: 'Hook already exists on this repository' }]
          }
        }
      });

      const result = await registerWebhook('owner', 'repo', 'url', 'secret');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('WEBHOOK_EXISTS');
    });
  });

  // ==========================================
  // Constants validation
  // ==========================================
  describe('Constants', () => {
    it('should have common code extensions', () => {
      expect(CODE_EXTENSIONS).toContain('.js');
      expect(CODE_EXTENSIONS).toContain('.py');
      expect(CODE_EXTENSIONS).toContain('.java');
      expect(CODE_EXTENSIONS).toContain('.ts');
    });

    it('should have common excluded paths', () => {
      expect(EXCLUDED_PATHS).toContain('node_modules/');
      expect(EXCLUDED_PATHS).toContain('.git/');
      expect(EXCLUDED_PATHS).toContain('vendor/');
    });
  });
});
