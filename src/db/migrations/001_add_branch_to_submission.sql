-- Migration: Add branch column to submission table
-- Run this migration to support multiple branches per repository

-- Add branch column
ALTER TABLE submission ADD COLUMN IF NOT EXISTS branch VARCHAR(255);

-- Add index for faster branch queries
CREATE INDEX IF NOT EXISTS idx_submission_branch ON submission(branch);

-- Add composite index for repo + branch lookups
CREATE INDEX IF NOT EXISTS idx_submission_github_branch ON submission(github_url, branch);
