const fs = require('fs');
const path = require('path');

function getSQL() {
  return `
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    settings_json TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS unit_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    unit_id TEXT NOT NULL,
    current_phase INTEGER DEFAULT 0,
    phase_1_completed_at TEXT,
    phase_2_completed_at TEXT,
    phase_3_completed_at TEXT,
    phase_4_completed_at TEXT,
    phase_5_completed_at TEXT,
    last_accessed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, unit_id)
);
CREATE INDEX idx_unit_progress_user ON unit_progress(user_id);
CREATE INDEX idx_unit_progress_phase ON unit_progress(current_phase);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    unit_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    question_type TEXT NOT NULL,
    user_answer TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    is_correct INTEGER NOT NULL DEFAULT 0,
    blanks_wrong TEXT,
    score REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_quiz_attempts_unit ON quiz_attempts(user_id, unit_id);

CREATE TABLE IF NOT EXISTS weak_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    unit_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    related_content TEXT,
    blanks_wrong TEXT,
    wrong_count INTEGER DEFAULT 1,
    last_wrong_at TEXT DEFAULT (datetime('now')),
    reviewed INTEGER DEFAULT 0,
    reviewed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, unit_id, question_id)
);

CREATE TABLE IF NOT EXISTS test_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    unit_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    question_type TEXT NOT NULL,
    user_answer TEXT,
    correct_answer TEXT NOT NULL,
    is_correct INTEGER NOT NULL DEFAULT 0,
    score REAL DEFAULT 0,
    max_score REAL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_test_attempts_unit ON test_attempts(user_id, unit_id);

CREATE TABLE IF NOT EXISTS error_book (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    unit_id TEXT NOT NULL,
    unit_path TEXT,
    question_id TEXT NOT NULL,
    question_type TEXT NOT NULL,
    question_stem TEXT NOT NULL,
    user_answer TEXT,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    options TEXT,
    source_test_attempt_id INTEGER,
    mastery_level INTEGER DEFAULT 0,
    times_reviewed INTEGER DEFAULT 0,
    next_review_due TEXT,
    is_resolved INTEGER DEFAULT 0,
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (source_test_attempt_id) REFERENCES test_attempts(id)
);
CREATE INDEX idx_error_book_user ON error_book(user_id);
CREATE INDEX idx_error_book_mastery ON error_book(mastery_level);
CREATE INDEX idx_error_book_due ON error_book(next_review_due);
-- Migration: add options column for existing DBs
ALTER TABLE error_book ADD COLUMN options TEXT;

CREATE TABLE IF NOT EXISTS final_exam_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    unit_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    question_type TEXT NOT NULL,
    user_answer TEXT,
    correct_answer TEXT NOT NULL,
    is_correct INTEGER NOT NULL DEFAULT 0,
    score REAL DEFAULT 0,
    add_to_error_book INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    unit_id TEXT NOT NULL,
    note_text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_user_notes_unit ON user_notes(user_id, unit_id);

CREATE TABLE IF NOT EXISTS review_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    unit_id TEXT NOT NULL,
    weak_point_ids TEXT NOT NULL,
    total_items INTEGER NOT NULL,
    items_correct INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    scene TEXT DEFAULT 'learn',
    unit_id TEXT DEFAULT '',
    current_page TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_chat_history_user ON chat_history(user_id);
CREATE INDEX idx_chat_history_created ON chat_history(created_at);

CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1 UNIQUE,
    study_style TEXT DEFAULT '',
    preferred_explanation TEXT DEFAULT '',
    study_time_preference TEXT DEFAULT '',
    weak_subjects TEXT DEFAULT '',
    custom_notes TEXT DEFAULT '',
    profile_json TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
`;
}

module.exports = { getSQL };
