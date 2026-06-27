import sqlite3

conn = sqlite3.connect('../skillforge.db')
c = conn.cursor()

# Drop old tables if exist (for clean start)
c.execute('DROP TABLE IF EXISTS users')
c.execute('DROP TABLE IF EXISTS user_gamification')
c.execute('DROP TABLE IF EXISTS user_progress')
c.execute('DROP TABLE IF EXISTS leaderboard')
c.execute('DROP TABLE IF EXISTS contacts')
c.execute('DROP TABLE IF EXISTS feedbacks')

# Users table
c.execute('''
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    coins INTEGER DEFAULT 0,
    badges TEXT DEFAULT '[]'
  )
''')

# Progress
c.execute('''
  CREATE TABLE IF NOT EXISTS user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    activity_id TEXT NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    score INTEGER DEFAULT 0,
    details TEXT DEFAULT '{}',
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
''')

# Gamification
c.execute('''
  CREATE TABLE IF NOT EXISTS user_gamification (
    user_id TEXT PRIMARY KEY,
    streak_days INTEGER DEFAULT 0,
    total_completions INTEGER DEFAULT 0,
    badges TEXT DEFAULT '[]',
    last_activity TEXT
  )
''')

# Leaderboard
c.execute('''
  CREATE TABLE IF NOT EXISTS leaderboard (
    user_id TEXT PRIMARY KEY,
    rank_score INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
''')

# Contacts
c.execute('''
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
''')

# Feedbacks
c.execute('''
  CREATE TABLE IF NOT EXISTS feedbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    feedback TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
''')

# Test user
c.execute("INSERT OR REPLACE INTO users (id, username, email, password, coins, badges) VALUES ('test@example.com', 'Test User', 'test@example.com', 'dummy', 0, '[]')")

conn.commit()
conn.close()
print("DB fixed & ready!")