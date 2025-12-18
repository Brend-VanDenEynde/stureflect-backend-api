const axios = require('axios');

/**
 * GitHub API configuratie
 */
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';

/**
 * Configuratie constanten (ruime limieten voor development)
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB max per bestand
const MAX_FILES_PER_COMMIT = 100; // Max bestanden per commit
const MAX_CONCURRENT_REQUESTS = 20; // Max parallelle requests

/**
 * Toegestane code bestand extensies
 */
const CODE_EXTENSIONS = [
  // JavaScript/TypeScript
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  // Python
  '.py', '.pyw',
  // Java/Kotlin
  '.java', '.kt', '.kts',
  // C/C++
  '.c', '.cpp', '.h', '.hpp', '.cc',
  // C#
  '.cs',
  // Go
  '.go',
  // Rust
  '.rs',
  // PHP
  '.php',
  // Ruby
  '.rb',
  // Swift
  '.swift',
  // Web
  '.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
  // Config/Data
  '.json', '.yaml', '.yml', '.xml', '.toml',
  // Shell
  '.sh', '.bash', '.zsh',
  // SQL
  '.sql',
  // Markdown
  '.md'
];

/**
 * Paden die uitgesloten worden
 */
const EXCLUDED_PATHS = [
  'node_modules/',
  '.git/',
  'vendor/',
  '__pycache__/',
  '.venv/',
  'venv/',
  'dist/',
  'build/',
  'out/',
  '.next/',
  '.nuxt/',
  'coverage/',
  '.cache/',
  '.idea/',
  '.vscode/',
  '.env',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'composer.lock',
  'Gemfile.lock'
];

/**
 * Parse een GitHub URL en extract owner en repo
 * @param {string} url - GitHub repository URL
 * @returns {{ owner: string, repo: string } | null}
 */
function parseGitHubUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Verwijder trailing slash en .git suffix
  let cleanUrl = url.trim().replace(/\/+$/, '').replace(/\.git$/, '');

  // Regex voor verschillende GitHub URL formats:
  // - https://github.com/owner/repo
  // - http://github.com/owner/repo
  // - github.com/owner/repo
  // - www.github.com/owner/repo
  const githubRegex = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/?$/;

  const match = cleanUrl.match(githubRegex);

  if (!match) {
    return null;
  }

  return {
    owner: match[1],
    repo: match[2]
  };
}

/**
 * Valideer een GitHub URL
 * @param {string} url - URL om te valideren
 * @returns {{ valid: boolean, error?: string, owner?: string, repo?: string }}
 */
function validateGitHubUrl(url) {
  if (!url) {
    return { valid: false, error: 'GitHub URL is verplicht' };
  }

  if (typeof url !== 'string') {
    return { valid: false, error: 'GitHub URL moet een string zijn' };
  }

  const trimmedUrl = url.trim();

  if (trimmedUrl.length === 0) {
    return { valid: false, error: 'GitHub URL mag niet leeg zijn' };
  }

  // Check of het een GitHub URL is (niet bijv. GitLab of Bitbucket)
  if (!trimmedUrl.toLowerCase().includes('github.com')) {
    return { valid: false, error: 'URL moet een GitHub repository zijn' };
  }

  const parsed = parseGitHubUrl(trimmedUrl);

  if (!parsed) {
    return { valid: false, error: 'Ongeldige GitHub URL format. Verwacht: https://github.com/owner/repo' };
  }

  // Valideer owner en repo namen
  if (parsed.owner.length === 0 || parsed.repo.length === 0) {
    return { valid: false, error: 'Owner en repository naam zijn verplicht' };
  }

  // GitHub gebruikersnamen en repo namen mogen niet beginnen met een dash
  if (parsed.owner.startsWith('-') || parsed.repo.startsWith('-')) {
    return { valid: false, error: 'Owner en repository naam mogen niet beginnen met een streepje' };
  }

  return {
    valid: true,
    owner: parsed.owner,
    repo: parsed.repo
  };
}

/**
 * Maak GitHub API headers aan (zonder auth)
 * @returns {object}
 */
function getGitHubHeaders() {
  return {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION
  };
}

/**
 * Maak GitHub API headers aan met authenticatie
 * @returns {object}
 */
function getGitHubHeadersWithAuth() {
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Check of een repository toegankelijk is (bestaat en publiek)
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository naam
 * @returns {Promise<{ accessible: boolean, repoData?: object, error?: string, errorCode?: string }>}
 */
async function checkRepositoryAccess(owner, repo) {
  try {
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}`,
      { headers: getGitHubHeaders() }
    );

    return {
      accessible: true,
      repoData: {
        id: response.data.id,
        name: response.data.name,
        full_name: response.data.full_name,
        default_branch: response.data.default_branch,
        private: response.data.private
      }
    };
  } catch (error) {
    if (error.response) {
      const status = error.response.status;

      if (status === 404) {
        return {
          accessible: false,
          error: 'Repository niet gevonden of niet publiek',
          errorCode: 'REPO_NOT_FOUND'
        };
      }

      if (status === 403) {
        // Rate limit of toegang geweigerd
        const rateLimitRemaining = error.response.headers['x-ratelimit-remaining'];
        if (rateLimitRemaining === '0') {
          return {
            accessible: false,
            error: 'GitHub API limiet bereikt, probeer later opnieuw',
            errorCode: 'RATE_LIMITED'
          };
        }
        return {
          accessible: false,
          error: 'Toegang tot repository geweigerd',
          errorCode: 'FORBIDDEN'
        };
      }
    }

    return {
      accessible: false,
      error: 'Fout bij ophalen GitHub repository',
      errorCode: 'GITHUB_ERROR'
    };
  }
}

/**
 * Haal de laatste commit SHA op voor de default branch
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository naam
 * @returns {Promise<{ success: boolean, sha?: string, error?: string, errorCode?: string }>}
 */
async function getLatestCommitSha(owner, repo) {
  try {
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits`,
      {
        headers: getGitHubHeaders(),
        params: { per_page: 1 }
      }
    );

    if (response.data.length === 0) {
      return {
        success: false,
        error: 'Repository heeft geen commits',
        errorCode: 'EMPTY_REPO'
      };
    }

    return {
      success: true,
      sha: response.data[0].sha
    };
  } catch (error) {
    if (error.response) {
      const status = error.response.status;

      if (status === 409) {
        // Git repository is empty
        return {
          success: false,
          error: 'Repository is leeg (geen commits)',
          errorCode: 'EMPTY_REPO'
        };
      }

      if (status === 403) {
        const rateLimitRemaining = error.response.headers['x-ratelimit-remaining'];
        if (rateLimitRemaining === '0') {
          return {
            success: false,
            error: 'GitHub API limiet bereikt, probeer later opnieuw',
            errorCode: 'RATE_LIMITED'
          };
        }
      }
    }

    return {
      success: false,
      error: 'Fout bij ophalen commits',
      errorCode: 'GITHUB_ERROR'
    };
  }
}

/**
 * Haal de repository file tree op via Git Trees API
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository naam
 * @param {string} sha - Commit SHA
 * @returns {Promise<{ success: boolean, files?: Array, truncated?: boolean, error?: string, errorCode?: string }>}
 */
async function getRepositoryTree(owner, repo, sha) {
  try {
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${sha}`,
      {
        headers: getGitHubHeaders(),
        params: { recursive: '1' }
      }
    );

    // Haal alleen blobs (files) op, geen trees (directories)
    const files = response.data.tree
      .filter(item => item.type === 'blob')
      .map(item => ({
        path: item.path,
        size: item.size || 0,
        sha: item.sha
      }));

    return {
      success: true,
      files,
      truncated: response.data.truncated || false
    };
  } catch (error) {
    if (error.response) {
      const status = error.response.status;

      if (status === 404) {
        return {
          success: false,
          error: 'Repository tree niet gevonden',
          errorCode: 'NOT_FOUND'
        };
      }

      if (status === 403) {
        const rateLimitRemaining = error.response.headers['x-ratelimit-remaining'];
        if (rateLimitRemaining === '0') {
          return {
            success: false,
            error: 'GitHub API limiet bereikt, probeer later opnieuw',
            errorCode: 'RATE_LIMITED'
          };
        }
      }
    }

    return {
      success: false,
      error: 'Fout bij ophalen repository bestanden',
      errorCode: 'GITHUB_ERROR'
    };
  }
}

/**
 * Filter bestanden op code extensies en excluded paths
 * @param {Array} files - Array van file objecten met path property
 * @returns {Array} - Gefilterde array van code bestanden
 */
function filterCodeFiles(files) {
  if (!Array.isArray(files)) return [];

  return files.filter(file => {
    // Null safety check
    if (!file || !file.path || typeof file.path !== 'string') {
      return false;
    }

    const path = file.path.toLowerCase();

    // Check of pad in excluded paths zit
    for (const excludedPath of EXCLUDED_PATHS) {
      if (path.startsWith(excludedPath.toLowerCase()) || path.includes('/' + excludedPath.toLowerCase())) {
        return false;
      }
      // Check exacte match voor bestanden zonder /
      if (!excludedPath.endsWith('/') && path === excludedPath.toLowerCase()) {
        return false;
      }
    }

    // Check of extensie toegestaan is
    const extension = '.' + path.split('.').pop();
    return CODE_EXTENSIONS.includes(extension);
  });
}

/**
 * Detecteer programmeertaal op basis van extensie
 * @param {string} filePath - Bestandspad
 * @returns {string} - Programmeertaal
 */
function detectLanguage(filePath) {
  if (!filePath || typeof filePath !== 'string') return 'unknown';

  // Check of bestand een extensie heeft
  const parts = filePath.split('.');
  if (parts.length < 2) return 'unknown'; // Geen extensie (bijv. Makefile, Dockerfile)

  const ext = '.' + parts.pop().toLowerCase();

  const languageMap = {
    '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
    '.ts': 'typescript', '.tsx': 'typescript',
    '.py': 'python', '.pyw': 'python',
    '.java': 'java',
    '.kt': 'kotlin', '.kts': 'kotlin',
    '.c': 'c', '.h': 'c',
    '.cpp': 'cpp', '.hpp': 'cpp', '.cc': 'cpp',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.php': 'php',
    '.rb': 'ruby',
    '.swift': 'swift',
    '.html': 'html',
    '.css': 'css', '.scss': 'scss', '.sass': 'sass', '.less': 'less',
    '.vue': 'vue', '.svelte': 'svelte',
    '.json': 'json',
    '.yaml': 'yaml', '.yml': 'yaml',
    '.xml': 'xml',
    '.toml': 'toml',
    '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
    '.sql': 'sql',
    '.md': 'markdown'
  };

  return languageMap[ext] || 'unknown';
}

/**
 * Haal gewijzigde bestanden op voor een specifieke commit
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository naam
 * @param {string} commitSha - Commit SHA
 * @returns {Promise<{ success: boolean, files?: Array, error?: string, errorCode?: string }>}
 */
async function getCommitFiles(owner, repo, commitSha) {
  try {
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${commitSha}`,
      {
        headers: getGitHubHeadersWithAuth(),
        timeout: 60000 // 60s timeout voor Dokploy
      }
    );

    const files = (response.data.files || []).map(file => ({
      path: file.filename,
      status: file.status, // added, modified, removed, renamed
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch || null // diff patch indien beschikbaar
    }));

    return {
      success: true,
      files,
      commit: {
        sha: response.data.sha,
        message: response.data.commit?.message || '',
        author: response.data.commit?.author?.name || 'unknown'
      }
    };
  } catch (error) {
    if (error.response) {
      const status = error.response.status;

      if (status === 404) {
        return {
          success: false,
          error: 'Commit niet gevonden',
          errorCode: 'COMMIT_NOT_FOUND'
        };
      }

      if (status === 403) {
        const rateLimitRemaining = error.response.headers['x-ratelimit-remaining'];
        if (rateLimitRemaining === '0') {
          return {
            success: false,
            error: 'GitHub API limiet bereikt, probeer later opnieuw',
            errorCode: 'RATE_LIMITED'
          };
        }
      }
    }

    return {
      success: false,
      error: 'Fout bij ophalen commit bestanden',
      errorCode: 'GITHUB_ERROR'
    };
  }
}

/**
 * Haal de inhoud van een bestand op
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository naam
 * @param {string} path - Bestandspad
 * @param {string} ref - Branch of commit SHA (optioneel)
 * @returns {Promise<{ success: boolean, content?: string, error?: string, errorCode?: string }>}
 */
async function getFileContent(owner, repo, path, ref = null) {
  try {
    const params = ref ? { ref } : {};

    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: getGitHubHeadersWithAuth(),
        params,
        timeout: 60000
      }
    );

    // Check file size limit
    if (response.data.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `Bestand te groot (${Math.round(response.data.size / 1024)}KB > ${MAX_FILE_SIZE / 1024}KB)`,
        errorCode: 'FILE_TOO_LARGE'
      };
    }

    // GitHub retourneert content als base64
    if (response.data.encoding === 'base64' && response.data.content) {
      try {
        const content = Buffer.from(response.data.content, 'base64').toString('utf8');
        return {
          success: true,
          content,
          size: response.data.size,
          sha: response.data.sha
        };
      } catch (decodeError) {
        return {
          success: false,
          error: 'Kan bestandsinhoud niet decoderen (mogelijk binair bestand)',
          errorCode: 'DECODE_ERROR'
        };
      }
    }

    // Als bestand via blob API moet (grote bestanden die toch binnen limiet vallen)
    if (response.data.sha) {
      return await getBlob(owner, repo, response.data.sha);
    }

    return {
      success: false,
      error: 'Kan bestandsinhoud niet decoderen',
      errorCode: 'DECODE_ERROR'
    };
  } catch (error) {
    if (error.response) {
      const status = error.response.status;

      if (status === 404) {
        return {
          success: false,
          error: 'Bestand niet gevonden',
          errorCode: 'FILE_NOT_FOUND'
        };
      }

      if (status === 403) {
        // Mogelijk te groot, probeer blob API
        return {
          success: false,
          error: 'Bestand te groot of toegang geweigerd',
          errorCode: 'FILE_TOO_LARGE'
        };
      }
    }

    return {
      success: false,
      error: 'Fout bij ophalen bestand',
      errorCode: 'GITHUB_ERROR'
    };
  }
}

/**
 * Haal blob content op (voor grote bestanden)
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository naam
 * @param {string} sha - Blob SHA
 * @returns {Promise<{ success: boolean, content?: string, error?: string }>}
 */
async function getBlob(owner, repo, sha) {
  try {
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/blobs/${sha}`,
      {
        headers: getGitHubHeadersWithAuth(),
        timeout: 60000
      }
    );

    // Check file size limit
    if (response.data.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `Bestand te groot (${Math.round(response.data.size / 1024)}KB > ${MAX_FILE_SIZE / 1024}KB)`,
        errorCode: 'FILE_TOO_LARGE'
      };
    }

    if (response.data.encoding === 'base64' && response.data.content) {
      try {
        const content = Buffer.from(response.data.content, 'base64').toString('utf8');
        return {
          success: true,
          content,
          size: response.data.size
        };
      } catch (decodeError) {
        return {
          success: false,
          error: 'Kan blob niet decoderen (mogelijk binair bestand)',
          errorCode: 'DECODE_ERROR'
        };
      }
    }

    return {
      success: false,
      error: 'Kan blob niet decoderen',
      errorCode: 'DECODE_ERROR'
    };
  } catch (error) {
    return {
      success: false,
      error: 'Fout bij ophalen blob',
      errorCode: 'GITHUB_ERROR'
    };
  }
}

/**
 * Registreer een webhook op een repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository naam
 * @param {string} webhookUrl - URL voor webhook callbacks
 * @param {string} secret - Webhook secret voor signature verificatie
 * @param {string} userToken - GitHub access token van de gebruiker (optioneel)
 * @returns {Promise<{ success: boolean, webhookId?: number, error?: string, errorCode?: string }>}
 */
async function registerWebhook(owner, repo, webhookUrl, secret, userToken = null) {
  try {
    // Gebruik user token als beschikbaar, anders server token
    const headers = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': GITHUB_API_VERSION
    };

    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
    } else if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const response = await axios.post(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/hooks`,
      {
        name: 'web',
        active: true,
        events: ['push'],
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: secret,
          insecure_ssl: '0'
        }
      },
      {
        headers,
        timeout: 60000
      }
    );

    return {
      success: true,
      webhookId: response.data.id
    };
  } catch (error) {
    if (error.response) {
      const status = error.response.status;

      if (status === 404) {
        return {
          success: false,
          error: 'Repository niet gevonden of geen toegang',
          errorCode: 'REPO_NOT_FOUND'
        };
      }

      if (status === 403) {
        return {
          success: false,
          error: 'Geen rechten om webhook te registreren',
          errorCode: 'FORBIDDEN'
        };
      }

      if (status === 422) {
        // Webhook bestaat mogelijk al
        const message = error.response.data?.errors?.[0]?.message || '';
        if (message.includes('already exists')) {
          return {
            success: false,
            error: 'Webhook bestaat al voor deze URL',
            errorCode: 'WEBHOOK_EXISTS'
          };
        }
      }
    }

    return {
      success: false,
      error: 'Fout bij registreren webhook',
      errorCode: 'GITHUB_ERROR'
    };
  }
}

/**
 * Verwijder een webhook van een repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository naam
 * @param {number} webhookId - Webhook ID
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function deleteWebhook(owner, repo, webhookId) {
  try {
    await axios.delete(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/hooks/${webhookId}`,
      {
        headers: getGitHubHeadersWithAuth(),
        timeout: 60000
      }
    );

    return { success: true };
  } catch (error) {
    if (error.response?.status === 404) {
      // Webhook bestaat niet meer, beschouw als success
      return { success: true };
    }

    return {
      success: false,
      error: 'Fout bij verwijderen webhook'
    };
  }
}

/**
 * Haal meerdere bestandsinhouden op met rate limiting
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository naam
 * @param {Array<string>} paths - Array van bestandspaden
 * @param {string} ref - Branch of commit SHA
 * @returns {Promise<Array<{ path: string, content?: string, error?: string }>>}
 */
async function getMultipleFileContents(owner, repo, paths, ref) {
  // Limiteer aantal bestanden
  const limitedPaths = paths.slice(0, MAX_FILES_PER_COMMIT);

  // Verwerk in batches om rate limiting te voorkomen
  const results = [];
  for (let i = 0; i < limitedPaths.length; i += MAX_CONCURRENT_REQUESTS) {
    const batch = limitedPaths.slice(i, i + MAX_CONCURRENT_REQUESTS);
    const batchResults = await Promise.all(
      batch.map(async (path) => {
        const result = await getFileContent(owner, repo, path, ref);
        return {
          path,
          content: result.success ? result.content : null,
          error: result.error || null,
          language: detectLanguage(path)
        };
      })
    );
    results.push(...batchResults);
  }

  return results;
}

module.exports = {
  parseGitHubUrl,
  validateGitHubUrl,
  checkRepositoryAccess,
  getLatestCommitSha,
  getRepositoryTree,
  filterCodeFiles,
  detectLanguage,
  getCommitFiles,
  getFileContent,
  getBlob,
  registerWebhook,
  deleteWebhook,
  getMultipleFileContents,
  getGitHubHeadersWithAuth,
  CODE_EXTENSIONS,
  EXCLUDED_PATHS,
  GITHUB_API_BASE,
  GITHUB_API_VERSION,
  MAX_FILE_SIZE,
  MAX_FILES_PER_COMMIT,
  MAX_CONCURRENT_REQUESTS
};