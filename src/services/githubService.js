const axios = require('axios');

/**
 * GitHub API configuratie
 */
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';

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
 * Maak GitHub API headers aan
 * @returns {object}
 */
function getGitHubHeaders() {
  return {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION
  };
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

module.exports = {
  parseGitHubUrl,
  validateGitHubUrl,
  checkRepositoryAccess,
  getLatestCommitSha,
  GITHUB_API_BASE,
  GITHUB_API_VERSION
};
