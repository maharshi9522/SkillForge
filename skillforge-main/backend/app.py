from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
import spacy
import librosa
import sqlite3
import numpy as np
from pydub import AudioSegment
import io
import re
from sklearn.metrics.pairwise import cosine_similarity
import json
from datetime import date
from typing import List, Dict
import os
import tempfile
import traceback
import random
import base64  # For TTS b64 if needed
import warnings  # To suppress deprecation warnings

from dotenv import load_dotenv
load_dotenv()  # Loads .env

# Suppress librosa FutureWarning
warnings.filterwarnings("ignore", category=FutureWarning)

# Groq Integration (pip install groq openai)
from openai import OpenAI
client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv('GROQ_API_KEY', '')  # Set your key in backend/.env
)

# Guarded imports with fallbacks
try:
    from ai.nlp.nlp_analysis import (
        compute_similarity, generate_suggestions, advanced_grammar_analysis,
        detect_fillers, generate_expected_keywords, compute_keyword_coverage
    )
except ImportError as e:
    print(f"NLP import error: {e}. Fallbacks active.")
    def compute_similarity(q, t): 
        # Basic fallback
        q_words = set(q.lower().split())
        t_words = set(t.lower().split())
        overlap = len(q_words.intersection(t_words)) / len(q_words) if q_words else 0
        return max(0.0, min(1.0, overlap))
    def generate_suggestions(t): return ["Good start—add examples!"]
    def advanced_grammar_analysis(t): return "Grammar: Solid."
    def detect_fillers(t): return len(re.findall(r'\bum\b|\buh\b|\blike\b|\ber\b|\bbasically\b|\byou know\b', t.lower(), re.IGNORECASE))
    def generate_expected_keywords(q, qt): return ['skills', 'experience', 'team', 'challenge']
    def compute_keyword_coverage(user_kws, expected): 
        user_set = set(user_kws)
        matches = sum(1 for kw in expected if any(word in kw.lower() for word in user_set))
        return matches / len(expected) if expected else 0

try:
    from ai.speech.speech_analysis import analyze_vocal_enhanced
except ImportError as e:
    print(f"Speech import error: {e}. Basic fallback.")
    def analyze_vocal_enhanced(p, t=""): 
        return {'fluency': 0.7, 'pauses': 1, 'vocal': 'Steady voice.', 'wpm': 120, 'energy_variation': 0.4, 'tempo_fluctuation': 0.1, 'jitter': 0.02, 'emotion': 'confident'}

try:
    from ai.speech.tts import generate_tts_audio_bytes
except ImportError:
    def generate_tts_audio_bytes(text, voice="default"): return None

app = Flask(__name__)
CORS(app)
app.config['JWT_SECRET_KEY'] = 'skillforge-secret-2025'
jwt = JWTManager(app)

DB_PATH = '../skillforge.db'

# SpaCy
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print("SpaCy model missing—install en_core_web_sm.")
    nlp = None

ADMIN_EMAILS = ['sanskar.chitnis241@vit.edu']

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
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
    # Updated user_progress with details column
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
    # If table exists without details, add it safely
    try:
        c.execute("ALTER TABLE user_progress ADD COLUMN details TEXT DEFAULT '{}'")
    except sqlite3.OperationalError:
        pass  # Column already exists
    c.execute('''
        CREATE TABLE IF NOT EXISTS user_gamification (
            user_id TEXT PRIMARY KEY,
            streak_days INTEGER DEFAULT 0,
            total_completions INTEGER DEFAULT 0,
            badges TEXT DEFAULT '[]',
            last_activity TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS leaderboard (
            user_id TEXT PRIMARY KEY,
            rank_score INTEGER DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS feedbacks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            feedback TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute("INSERT OR IGNORE INTO users VALUES ('test@example.com', 'Test User', 'test@example.com', ?, 0, '[]')", (generate_password_hash('dummy'),))
    conn.commit()
    conn.close()
    print("DB initialized.")

init_db()

def analyze_sentiment_emotion(text):
    if not nlp or not text.strip(): return "neutral", "hesitant"
    doc = nlp(text)
    sentiment_score = sum(token.sentiment for token in doc)
    sentiment = "positive" if sentiment_score > 0.1 else "negative" if sentiment_score < -0.1 else "neutral"
    emotion = "confident" if any(word in text.lower() for word in ["excited", "achieve", "strength"]) else "hesitant"
    if "don't know" in text.lower(): emotion = "hesitant"
    return sentiment, emotion

def generate_discussion_reply(topic, user_input, conversation):
    try:
        prompt = f"""
        Topic: {topic}

        Conversation so far: {json.dumps(conversation)}

        User: {user_input}

        Respond as an engaging discussion partner, 1-2 sentences, insightful and encouraging.
        """
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0.8
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Discussion reply error: {e}")
        return "Interesting point! What makes you think that? Let's explore this further."

def generate_mock_feedback(text, question_type, similarity, fluency, sentiment, vocal):
    # Simple heuristic fallback
    strengths = ["Your response shows good intent—build on that!"]
    improvements = ["Add more specifics next time."]
    mock_tips = ["Practice with STAR method."]
    return strengths, improvements, mock_tips

@app.route('/api/analyze', methods=['POST'])
def analyze():
    result = {
        'overall': 0, 'semantic_similarity': 0.0, 'fluency': 0.0, 'filler_count': 0,
        'pauses': 0, 'keyword_coverage': 0.0, 'wpm': 0, 'energy_variation': 0.0,
        'tempo_fluctuation': 0.0, 'jitter': 0.0, 'strengths': [], 'improvements': [], 'mock_tips': [],
        'example_answer': '', 'grammar': "Analysis in progress...", 'sentiment': "neutral",
        'emotion': "neutral", 'vocal': "Analysis in progress...", 'blended_confidence': 0.0
    }
    
    try:
        text = request.form.get('text', '').strip()
        audio_file = request.files.get('audio')
        js_conf = float(request.form.get('confidence', 0.5))
        question = request.form.get('question', '')
        question_type = request.form.get('question_type', 'default')

        if not text and not audio_file:
            result['error'] = 'No input—let\'s hear your thoughts!'
            return jsonify(result), 400

        is_uncertain = any(phrase in text.lower() for phrase in ["don't know", "sorry", "unsure", "idk"])

        # Semantic
        result['semantic_similarity'] = compute_similarity(question, text)
        if is_uncertain: result['semantic_similarity'] *= 0.3

        # Fillers & Keywords
        result['filler_count'] = detect_fillers(text)
        if is_uncertain: result['filler_count'] += 3
        expected_keywords = generate_expected_keywords(question, question_type)
        user_keywords = [token.text.lower() for token in nlp(text) if token.is_alpha and len(token.text) > 3] if nlp else text.lower().split()
        result['keyword_coverage'] = compute_keyword_coverage(user_keywords, expected_keywords)

        # Grammar
        result['grammar'] = advanced_grammar_analysis(text)

        # Sentiment/Emotion
        result['sentiment'], result['emotion'] = analyze_sentiment_emotion(text)

        # Vocal + Delivery
        result['pauses'] = 0; result['fluency'] = 0.5; result['vocal'] = "Voice analysis pending—full recording unlocks your unique rhythm!"
        result['blended_confidence'] = js_conf * 0.5; result['wpm'] = 0; result['energy_variation'] = 0.0
        result['tempo_fluctuation'] = 0.0; result['jitter'] = 0.0
        if audio_file:
            try:
                temp_dir = tempfile.gettempdir()
                temp_path = os.path.join(temp_dir, f"temp_audio_{random.randint(1000,9999)}.wav")
                print(f"Saving audio to temp: {temp_path}")  # Debug
                audio_file.save(temp_path)
                vocal_result = analyze_vocal_enhanced(temp_path, text)  # Pass text for WPM
                if isinstance(vocal_result, dict):
                    result.update(vocal_result)
                # Adjust for uncertainty/short text
                if len(text) < 30 or is_uncertain:
                    result['fluency'] *= 0.6
                result['blended_confidence'] = min(js_conf * 0.4 + result['fluency'] * 0.6, 1.0)
                print("Vocal analysis success")  # Debug
            except Exception as vocal_e:
                print(f"Vocal error details: {vocal_e}")  # Better logging
                result['vocal'] = "Audio blip—retry for your full vocal story; it's worth it!"
            finally:
                # Safe delete
                try:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
                        print(f"Temp file deleted: {temp_path}")  # Debug
                    else:
                        print(f"Temp file not found for delete: {temp_path} (already cleaned?)")  # Debug
                except Exception as delete_e:
                    print(f"Delete error (ignore): {delete_e}")
        else:
            print("No audio file—using text-only analysis")  # Debug
            # Text-only defaults
            word_count = len(text.split())
            result['wpm'] = word_count / 0.5 * 60 if word_count else 0  # Assume 30s speak time
            result['energy_variation'] = 0.4
            result['tempo_fluctuation'] = 0.1
            result['jitter'] = 0.02
            result['emotion'] = 'confident'

        # Dynamic Groq LLM Feedback (robust parsing + safe fallback)
        try:
            print("Calling Groq LLM for feedback...")  # Debug
            prompt = f"""
            You are an expert mock interview coach—empathetic, encouraging, specific like a trusted mentor for Indian placements.
            Question: "{question}" (Type: {question_type})

            User Transcript: "{text}"
            Metrics:
            - Semantic Similarity: {result['semantic_similarity']:.1%}
            - Fluency: {result['fluency']:.1%}
            - Fillers: {result['filler_count']}
            - Pauses: {result['pauses']}
            - Keyword Coverage: {result['keyword_coverage']:.1%}
            - WPM: {result['wpm']}
            - Energy Variation: {result['energy_variation']:.2f} (higher = dynamic)
            - Tempo Fluctuation: {result['tempo_fluctuation']:.2f} (lower = steady)
            - Jitter: {result['jitter']:.2f} (lower = confident)
            - Grammar: {result['grammar']}
            - Sentiment: {result['sentiment']}
            - Emotion/Tone: {result['emotion']}

            Generate in JSON only:
            {{
                "strengths": ["1-3 bullets: Warm praise on highs (e.g., 'Your {result['wpm']} WPM kept it natural—engaging!')"],
                "improvements": ["1-3 bullets: Gentle, actionable fixes on lows (e.g., '{result['filler_count']} fillers—try breath anchors for polish.')"],
                "mock_tips": ["1-2 pro tips: Tailored to type/metrics (e.g., STAR for behavioral; '120-150 WPM ideal for clarity.')"],
                "example_answer": "2-4 sentence model: Concise, ideal version using user's strengths + fixes (quantify, STAR if behavioral)."
            }}
            Keep encouraging, specific, under 200 words. For uncertainty: 'Honesty shines—pivot to growth stories like \"Eager to explore...\"!'
            Indian context: Suggest cultural fits like confident eye contact in panels.
            """

            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=400,
                temperature=0.7
            )

            # Robust extraction of text from various possible response shapes
            raw_text = ""
            try:
                if hasattr(response, "choices") and len(response.choices) > 0:
                    choice = response.choices[0]
                    # Try common fields in priority
                    if hasattr(choice, "message"):
                        msg = choice.message
                        raw_text = getattr(msg, "content", None) or (msg.get("content") if isinstance(msg, dict) else None)
                    if not raw_text:
                        raw_text = getattr(choice, "text", None) or (choice.get("text") if isinstance(choice, dict) else None)
                if not raw_text:
                    # fallback to converting entire response
                    raw_text = getattr(response, "text", None) or str(response)
            except Exception as ex:
                print("Error extracting raw LLM text:", ex)
                raw_text = str(response)

            raw_text = raw_text.strip() if isinstance(raw_text, str) else str(raw_text)

            # Try to locate JSON substring (the model may wrap JSON with commentary)
            llm_output = None
            try:
                import re
                m = re.search(r'\{[\s\S]*\}', raw_text)
                json_text = m.group(0) if m else raw_text
                llm_output = json.loads(json_text)
                print("Groq LLM parsed JSON successfully")
            except Exception as parse_e:
                print("LLM JSON parse failed:", parse_e)
                print("Raw LLM output preview:", raw_text[:800].replace("\n", " "))
                llm_output = None

            if llm_output:
                result['strengths'] = llm_output.get('strengths', [])
                result['improvements'] = llm_output.get('improvements', [])
                result['mock_tips'] = llm_output.get('mock_tips', [])
                result['example_answer'] = llm_output.get('example_answer', '')
            else:
                # Safe fallback: use internal heuristic generator so UI still receives meaningful feedback
                try:
                    strengths, improvements, mock_tips = generate_mock_feedback(text, question_type, result['semantic_similarity'], result.get('fluency', 0.5), result.get('sentiment', 'neutral'), result.get('vocal', ''))
                    result['strengths'] = strengths
                    result['improvements'] = improvements
                    result['mock_tips'] = mock_tips
                    result['example_answer'] = "Model answer unavailable — try again or enable LLM debugging."
                except Exception as fallback_e:
                    print("Fallback feedback generation failed:", fallback_e)
                    result['strengths'] = ["Good attempt — specifics will be provided after retry."]
                    result['improvements'] = ["Retry the analysis; an assistant will produce tailored tips."]
                    result['mock_tips'] = []
                    result['example_answer'] = ""
        except Exception as llm_e:
            # Ensure LLM exceptions don't break analysis; keep a helpful fallback
            print(f"Groq LLM error details: {llm_e}\n{traceback.format_exc()}")
            try:
                strengths, improvements, mock_tips = generate_mock_feedback(text, question_type, result['semantic_similarity'], result.get('fluency', 0.5), result.get('sentiment', 'neutral'), result.get('vocal',''))
                result['strengths'] = strengths
                result['improvements'] = improvements
                result['mock_tips'] = mock_tips
                result['example_answer'] = "Model answer unavailable due to LLM error."
            except Exception:
                result['strengths'] = ["Analysis unavailable."]
                result['improvements'] = []
                result['mock_tips'] = []
                result['example_answer'] = ""

        # Overall Score (Advanced Weighted)
        weights = {
            'semantic_similarity': 0.25, 'fluency': 0.20, 'keyword_coverage': 0.15,
            'blended_confidence': 0.15, 'energy_variation': 0.10, 'tempo_fluctuation': 0.10,
            'wpm': 0.05
        }
        wpm_norm = max(0, min(1, (result['wpm'] - 80) / 70))
        tempo_norm = max(0, min(1, 1 - result['tempo_fluctuation']))
        energy_norm = min(1, result['energy_variation'] * 2)
        jitter_penalty = 1 - min(1, result['jitter'] * 0.5)
        score_sum = (
            result['semantic_similarity'] * weights['semantic_similarity'] +
            result['fluency'] * weights['fluency'] +
            result['keyword_coverage'] * weights['keyword_coverage'] +
            result['blended_confidence'] * weights['blended_confidence'] +
            energy_norm * weights['energy_variation'] +
            tempo_norm * weights['tempo_fluctuation'] +
            wpm_norm * weights['wpm'] * jitter_penalty
        )
        result['overall'] = int(score_sum * 100)
        if is_uncertain: result['overall'] = max(0, result['overall'] * 0.7)

        print(f"Full result keys: {list(result.keys())}")  # Debug: Confirm all fields

    except Exception as e:
        print(f"Critical analyze error: {e}\n{traceback.format_exc()}")
        result['error'] = "Unexpected hiccup—let's try again; your input's gold!"

    # Optional: TTS Audio
    if request.form.get('include_tts', 'false').lower() == 'true':
        tts_bytes = generate_tts_audio_bytes(result['vocal'], "default")
        if tts_bytes:
            result['tts_audio_b64'] = base64.b64encode(tts_bytes).decode('utf-8')

    return jsonify(result)

@app.route('/api/award-coins', methods=['POST'])
@jwt_required()
def award_coins():
    try:
        user_id = get_jwt_identity()
        data = request.json
        base_coins = 10
        bonus = 5 if data.get('confidence', 0) > 0.8 and data.get('relevance', 0) > 0.6 else 0
        total = base_coins + bonus
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("UPDATE users SET coins = coins + ? WHERE id = ?", (total, user_id))
        coin_row = c.execute("SELECT coins FROM users WHERE id = ?", (user_id,)).fetchone()
        new_coins = coin_row[0] if coin_row else 0
        
        badge_row = c.execute("SELECT badges FROM users WHERE id = ?", (user_id,)).fetchone()
        current_badges = json.loads(badge_row[0] if badge_row else '[]')
        questions_completed = data.get('questionIndex', 0) + 1
        new_badges = []
        if questions_completed % 5 == 0 and 'Bronze Speaker' not in current_badges:
            new_badges.append('Bronze Speaker')
            current_badges.append('Bronze Speaker')
            c.execute("UPDATE users SET badges = ? WHERE id = ?", (json.dumps(current_badges), user_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'coins': new_coins, 'newBadges': new_badges})
    except Exception as e:
        print("Error in /api/award-coins:", e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.json
    username = data['username']
    email = data['email']
    password = generate_password_hash(data['password'])

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (id, username, email, password) VALUES (?, ?, ?, ?)", (email, username, email, password))
        conn.commit()
        access_token = create_access_token(identity=email)
        return jsonify({'token': access_token, 'user': email, 'username': username, 'msg': 'Signed up!'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'User exists'}), 400
    finally:
        conn.close()

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    email = data['email']
    password = data['password']

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT password, username FROM users WHERE id = ?", (email,))
    row = c.fetchone()
    conn.close()
    if row and check_password_hash(row[0], password):
        access_token = create_access_token(identity=email)
        return jsonify({'token': access_token, 'user': email, 'username': row[1], 'msg': 'Logged in!'})
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/progress/complete', methods=['POST'])
@jwt_required()
def complete_activity():
    try:
        user_id = get_jwt_identity()
        data = request.json
        activity_type = data['activityType']
        activity_id = data['activityId']
        score = data.get('score', 0)
        details = json.dumps(data.get('details', {}))

        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()

        # Only count aptitude practice questions (not full tests or behavioral)
        is_practice_question = (activity_type == 'aptitude' and str(activity_id).isdigit())

        # Insert progress entry
        c.execute("""
            INSERT INTO user_progress 
            (user_id, activity_type, activity_id, score, details) 
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, activity_type, str(activity_id), score, details))

        # === Only increment streak & score for practice questions ===
        if is_practice_question:
            today = date.today().isoformat()

            # Get current gamification row
            c.execute("SELECT streak_days, last_activity FROM user_gamification WHERE user_id = ?", (user_id,))
            row = c.fetchone()

            new_streak = 1
            if row and row[1] == today:
                new_streak = row[0] + 1  # Continue streak
            elif row and row[1]:
                # Could check if yesterday, but for simplicity: reset if not today
                new_streak = 1

            # Update streak_days = number of practice questions solved
            c.execute("""
                INSERT OR REPLACE INTO user_gamification 
                (user_id, streak_days, last_activity, total_completions, badges)
                VALUES (?, ?, ?, 
                    COALESCE((SELECT total_completions FROM user_gamification WHERE user_id = ?), 0) + 1,
                    COALESCE((SELECT badges FROM user_gamification WHERE user_id = ?), '[]')
                )
            """, (user_id, new_streak, today, user_id, user_id))

            # Update rank_score = practice questions × 100
            practice_count = new_streak  # Since we increment only on practice Qs
            rank_score = practice_count * 100

            c.execute("""
                INSERT OR REPLACE INTO leaderboard (user_id, rank_score)
                VALUES (?, ?)
            """, (user_id, rank_score))

        conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'streak': new_streak if is_practice_question else 0,
            'rank_score': rank_score if is_practice_question else 0
        })

    except Exception as e:
        print("Error in complete_activity:", e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/progress/profile/me', methods=['GET'])
@jwt_required()
def get_my_profile():
    user_id = get_jwt_identity()  # This is the logged-in user's email/id

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # === Get Progress ===
    c.execute("SELECT * FROM user_progress WHERE user_id = ?", (user_id,))
    progress = []
    for r in c.fetchall():
        details = {}
        if len(r) > 6 and r[6]:  # details column exists and not null
            try:
                details = json.loads(r[6])
            except:
                details = {}
        progress.append({
            'id': r[0],
            'user_id': r[1],
            'activity_type': r[2],
            'activity_id': r[3],
            'completed_at': r[4],
            'score': r[5],
            'details': details
        })

    # === Get Gamification Stats ===
    c.execute("SELECT streak_days, total_completions, badges FROM user_gamification WHERE user_id = ?", (user_id,))
    gam_row = c.fetchone()
    gamify = {
        'streak_days': gam_row[0] if gam_row else 0,
        'total_completed': gam_row[1] if gam_row else 0,
        'badges': json.loads(gam_row[2]) if gam_row and gam_row[2] else []
    }

    # === Get Coins ===
    c.execute("SELECT coins FROM users WHERE id = ?", (user_id,))
    coin_row = c.fetchone()
    gamify['coins'] = coin_row[0] if coin_row else 0

    conn.close()

    return jsonify({
        'progress': progress,
        'gamify': gamify
    })

@app.route('/api/progress/profile/<path:user_id>', methods=['GET'])
@jwt_required()
def get_profile(user_id):
    current_user = get_jwt_identity()
    if current_user != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT * FROM user_progress WHERE user_id = ?", (user_id,))
    progress = [{'id': r[0], 'user_id': r[1], 'activity_type': r[2], 'activity_id': r[3], 'completed_at': r[4], 'score': r[5], 'details': json.loads(r[6]) if len(r) > 6 else {}} for r in c.fetchall()]
    c.execute("SELECT * FROM user_gamification WHERE user_id = ?", (user_id,))
    gamify_row = c.fetchone()
    gamify = {'streak_days': gamify_row[1] if gamify_row else 0, 'total_completed': gamify_row[2] if gamify_row else 0, 'badges': json.loads(gamify_row[3] if gamify_row else '[]')}
    c.execute("SELECT coins FROM users WHERE id = ?", (user_id,))
    coin_row = c.fetchone()
    gamify['coins'] = coin_row[0] if coin_row else 0
    conn.close()
    return jsonify({'progress': progress, 'gamify': gamify})

# ADD THIS ROUTE IN YOUR app.py
@app.route('/api/gamification/minigame', methods=['POST'])
@jwt_required()
def award_minigame_coins():
    try:
        user_id = get_jwt_identity()
        data = request.json
        reward = data.get('reward', 50)

        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Add coins
        c.execute("UPDATE users SET coins = coins + ? WHERE id = ?", (reward, user_id))
        
        # Update total completions (for level)
        c.execute("""
            INSERT OR REPLACE INTO user_gamification 
            (user_id, total_completions, streak_days, last_activity, badges) 
            VALUES (?, 
                COALESCE((SELECT total_completions FROM user_gamification WHERE user_id = ?), 0) + 1,
                COALESCE((SELECT streak_days FROM user_gamification WHERE user_id = ?), 0),
                date('now'),
                COALESCE((SELECT badges FROM user_gamification WHERE user_id = ?), '[]')
            )
        """, (user_id, user_id, user_id, user_id))

        conn.commit()
        conn.close()
        return jsonify({"success": True, "coins_added": reward})
    except Exception as e:
        print("Mini-game reward error:", e)
        return jsonify({"error": "Failed to award coins"}), 500

@app.route('/api/progress/leaderboard', methods=['GET'])
@jwt_required()
def get_leaderboard():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        SELECT 
            u.username,
            COALESCE(g.streak_days, 0),
            COALESCE(g.total_completions, 0),
            COALESCE(l.rank_score, 0)
        FROM users u
        LEFT JOIN user_gamification g ON u.id = g.user_id
        LEFT JOIN leaderboard l ON u.id = l.user_id
        ORDER BY l.rank_score DESC, g.total_completions DESC
        LIMIT 10
    """)
    rows = [{
        'username': r[0] or 'Player',
        'streak_days': r[1],
        'total_completed': r[2],
        'rank_score': r[3]
    } for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@app.route('/api/contact', methods=['POST'])
def contact():
    try:
        data = request.json
        if not data or not all(k in data for k in ['name', 'email', 'message']):
            return jsonify({'error': 'Missing required fields'}), 400
        
        print(f"New Contact: Name={data['name']}, Email={data['email']}, Message={data['message']}")
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)", 
                  (data['name'], data['email'], data['message']))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'msg': 'Message sent successfully!'})
    except Exception as e:
        print(f"Contact error: {e}")
        return jsonify({'error': 'Failed to send message'}), 500

@app.route('/api/feedback', methods=['POST'])
def feedback():
    try:
        data = request.json
        if not data or not all(k in data for k in ['name', 'feedback']):
            return jsonify({'error': 'Missing required fields'}), 400
        
        print(f"New Feedback: Name={data['name']}, Feedback={data['feedback']}")
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("INSERT INTO feedbacks (name, feedback) VALUES (?, ?)", 
                  (data['name'], data['feedback']))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'msg': 'Feedback submitted successfully!'})
    except Exception as e:
        print(f"Feedback error: {e}")
        return jsonify({'error': 'Failed to submit feedback'}), 500

@app.route('/api/admin/contacts', methods=['GET'])
@jwt_required()
def get_contacts():
    user_email = get_jwt_identity()
    if user_email not in ADMIN_EMAILS:
        return jsonify({'error': 'Access denied. Admin only.'}), 403
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, name, email, message, created_at FROM contacts ORDER BY created_at DESC")
    contacts = [{'id': r[0], 'name': r[1], 'email': r[2], 'message': r[3], 'created_at': r[4]} for r in c.fetchall()]
    conn.close()
    return jsonify({'contacts': contacts})

@app.route('/api/admin/feedbacks', methods=['GET'])
@jwt_required()
def get_feedbacks():
    user_email = get_jwt_identity()
    if user_email not in ADMIN_EMAILS:
        return jsonify({'error': 'Access denied. Admin only.'}), 403
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, name, feedback, created_at FROM feedbacks ORDER BY created_at DESC")
    feedbacks = [{'id': r[0], 'name': r[1], 'feedback': r[2], 'created_at': r[3]} for r in c.fetchall()]
    conn.close()
    return jsonify({'feedbacks': feedbacks})

@app.route('/api/discussion/respond', methods=['POST'])
def discussion_respond():
    try:
        data = request.json
        topic = data.get('topic', '')
        user_input = data.get('userInput', '').strip()
        conversation = data.get('conversation', [])

        if not topic or not user_input:
            return jsonify({'error': 'Missing topic or input'}), 400

        relevance = compute_similarity(topic, user_input)

        ai_response = generate_discussion_reply(topic, user_input, conversation)

        return jsonify({
            'response': ai_response,
            'relevance': relevance,
            'suggestions': generate_suggestions(user_input)
        })
    except Exception as e:
        print(f"Discussion respond error: {e}")
        fallback = "Sorry, let's continue—tell me more about your view on the topic."
        return jsonify({'error': str(e), 'response': fallback}), 500

@app.errorhandler(401)
def unauthorized_error(error):
    return jsonify({
        'error': 'Unauthorized access. Please login first.',
        'status': 401
    }), 401

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'error': 'Internal server error occurred.',
        'status': 500
    }), 500

@app.route('/api/aptitude/questions', methods=['GET'])
def get_aptitude_questions():
    try:
        questions: List[Dict] = [
            {
                "id": 1,
                "question": "What comes next in the sequence: 2, 4, 8, 16, __?",
                "options": ["24", "28", "32", "36"],
                "correct": "32",
                "type": "numerical",
                "explanation": "The pattern multiplies each number by 2"
            },
            {
                "id": 2,
                "question": "If 5 workers can build a wall in 8 days, how many days will it take 10 workers?",
                "options": ["2", "4", "6", "8"],
                "correct": "4",
                "type": "logical",
                "explanation": "Double the workers means half the time"
            },
            {
                "id": 3,
                "question": "Which word completes the analogy? Book is to Reading as Fork is to:",
                "options": ["Kitchen", "Eating", "Cooking", "Food"],
                "correct": "Eating",
                "type": "verbal",
                "explanation": "Book is used for Reading, Fork is used for Eating"
            }
        ]
        return jsonify(questions)
    except Exception as e:
        print(f"Error fetching aptitude questions: {str(e)}")
        return jsonify({"error": "Failed to fetch questions"}), 500

@app.route('/api/aptitude/submit', methods=['POST'])
@jwt_required()
def submit_aptitude_answer():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        question_id = data.get('questionId')
        user_answer = data.get('answer')
        
        if not question_id or user_answer is None:
            return jsonify({"error": "Missing questionId or answer"}), 400

        questions = [
            {"id": 1, "correct": "32"},
            {"id": 2, "correct": "4"},
            {"id": 3, "correct": "Eating"}
        ]
        
        question = next((q for q in questions if q["id"] == question_id), None)
        if not question:
            return jsonify({"error": "Invalid question ID"}), 400
            
        is_correct = str(user_answer) == question["correct"]
        score = 10 if is_correct else 0
        
        user_id = get_jwt_identity()
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("""
            INSERT INTO user_progress 
            (user_id, activity_type, activity_id, score) 
            VALUES (?, 'aptitude', ?, ?)
        """, (user_id, str(question_id), score))
        conn.commit()
        conn.close()
        
        response = {
            "correct": is_correct,
            "feedback": "Great job!" if is_correct else "Try again!",
            "score": score
        }
        
        return jsonify(response)
    except Exception as e:
        print(f"Error processing aptitude answer: {str(e)}")
        return jsonify({"error": "Failed to process answer"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)  