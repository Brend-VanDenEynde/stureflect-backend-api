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

module.exports = {
  parseGitHubUrl,
  validateGitHubUrl,
  GITHUB_API_BASE,
  GITHUB_API_VERSION
};
