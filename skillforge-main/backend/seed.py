import sqlite3
DB_PATH = '../skillforge.db'
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()
c.execute("INSERT INTO user_progress VALUES (NULL, 'test@example.com', 'aptitude', 'apt1', CURRENT_TIMESTAMP, 100, '{}')")
c.execute("INSERT INTO user_progress VALUES (NULL, 'test@example.com', 'mock_interview', 'mock1', CURRENT_TIMESTAMP, 80, '{}')")
c.execute("INSERT INTO user_gamification VALUES ('test@example.com', 3, 2, '[]', '2025-10-27')")
c.execute("INSERT INTO leaderboard VALUES ('test@example.com', 180, CURRENT_TIMESTAMP)")
conn.commit()
conn.close()
print("Seeded!")