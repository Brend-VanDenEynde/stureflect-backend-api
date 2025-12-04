"""markdown
# Database Schema Guide

## Overview
PostgreSQL database design for StuReflect platform.

## Core Tables

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  password_hash VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'student', -- 'student', 'teacher', 'admin'
  avatar_url TEXT,
  github_id VARCHAR(100) UNIQUE,
  github_username VARCHAR(100),
  github_token TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### classes
```sql
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  code VARCHAR(20) UNIQUE NOT NULL, -- Join code for students
  semester VARCHAR(50),
  year INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### class_enrollments
```sql
CREATE TABLE class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(class_id, student_id)
);
```

### repositories
```sql
CREATE TABLE repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  repo_name VARCHAR(255) NOT NULL,
  repo_url TEXT NOT NULL,
  repo_owner VARCHAR(100) NOT NULL,
  github_repo_id VARCHAR(100) UNIQUE,
  is_active BOOLEAN DEFAULT true,
  linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### submissions
```sql
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES assignments(id),
  commit_hash VARCHAR(40) NOT NULL,
  commit_message TEXT,
  branch VARCHAR(255) DEFAULT 'main',
  pushed_at TIMESTAMP NOT NULL,
  analyzed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### assignments
```sql
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  curriculum_content TEXT, -- Course material/learning objectives
  due_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### code_analysis
```sql
CREATE TABLE code_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  language VARCHAR(50),
  lines_of_code INTEGER,
  complexity_score DECIMAL(5,2),
  test_coverage DECIMAL(5,2),
  build_status VARCHAR(20), -- 'success', 'failed', 'error'
  lint_errors INTEGER,
  lint_warnings INTEGER,
  raw_analysis JSONB,
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### ai_feedback
```sql
CREATE TABLE ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  analysis_id UUID NOT NULL REFERENCES code_analysis(id) ON DELETE CASCADE,
  feedback_text TEXT NOT NULL,
  feedback_type VARCHAR(50), -- 'improvement', 'error', 'style', 'concept'
  curriculum_reference TEXT, -- Link to course material
  severity VARCHAR(20), -- 'critical', 'warning', 'info'
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### student_progress
```sql
CREATE TABLE student_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES assignments(id),
  total_submissions INTEGER DEFAULT 0,
  average_complexity DECIMAL(5,2),
  average_test_coverage DECIMAL(5,2),
  feedback_count INTEGER DEFAULT 0,
  last_submission_at TIMESTAMP,
  progress_percentage DECIMAL(5,2),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### class_analytics
```sql
CREATE TABLE class_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  total_students INTEGER DEFAULT 0,
  avg_submission_frequency DECIMAL(5,2),
  most_common_error VARCHAR(255),
  struggling_concepts TEXT[],
  avg_code_quality DECIMAL(5,2),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Indexes

```sql
CREATE INDEX idx_users_github_id ON users(github_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX idx_enrollments_student_id ON class_enrollments(student_id);
CREATE INDEX idx_enrollments_class_id ON class_enrollments(class_id);
CREATE INDEX idx_repositories_student_id ON repositories(student_id);
CREATE INDEX idx_submissions_student_id ON submissions(student_id);
CREATE INDEX idx_submissions_repository_id ON submissions(repository_id);
CREATE INDEX idx_feedback_submission_id ON ai_feedback(submission_id);
CREATE INDEX idx_progress_student_class ON student_progress(student_id, class_id);
```

## Data Relationships

```
users (teachers & students)
  ├── classes (created by teachers)
  │   ├── class_enrollments (students join)
  │   ├── assignments (course material)
  │   └── class_analytics
  │
  ├── repositories (students link GitHub)
  │   └── submissions (code pushes)
  │       ├── code_analysis (automated analysis)
  │       └── ai_feedback (generated feedback)
  │
  └── student_progress (tracks learning)
```

## Notes
- All timestamps use UTC
- IDs are UUIDs for security
- Foreign keys cascade on delete
- Indexes optimize common queries
- JSONB for flexible analysis data storage

"""
