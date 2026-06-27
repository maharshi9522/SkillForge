from sentence_transformers import SentenceTransformer, util
import spacy
import re
import random
import os
from openai import OpenAI  # Groq via OpenAI client
client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=os.getenv('GROQ_API_KEY', ''))

model = SentenceTransformer('all-MiniLM-L6-v2')
nlp = spacy.load("en_core_web_sm")

def compute_similarity(text_a, text_b):
    if not text_a.strip() or not text_b.strip(): return 0.0
    try:
        a = model.encode(text_a, convert_to_tensor=True)
        b = model.encode(text_b, convert_to_tensor=True)
        cos = util.pytorch_cos_sim(a, b).item()
        uncertainty_penalty = 0.3 if any(phrase in text_b.lower() for phrase in ["don't know", "sorry", "unsure", "idk", "um"]) else 1.0
        return max(0.0, min(1.0, float(cos) * uncertainty_penalty))
    except Exception as e:
        print(f"Similarity error: {e}")
        return 0.2 if "don't know" in text_b.lower() else 0.5

def generate_suggestions(transcript):
    if not transcript.strip(): return ["Dive in with a full response—I'm here to refine it with you!"]
    words = len(transcript.split())
    fillers = detect_fillers(transcript)  # Use new func
    suggestions = []
    if words < 25: suggestions.append("Let's build on that—add a personal example or two to flesh it out and show your spark.")
    if words > 140: suggestions.append(f"Strong depth there ({words} words)—trim to 90-100 for punchier impact that sticks.")
    if fillers > 1: suggestions.append(f"Nice flow, but {fillers} fillers crept in—swap 'em for a quick breath; it amps your poise.")
    if any(phrase in transcript.lower() for phrase in ["don't know", "sorry", "um"]):
        suggestions.append("Love the honesty, but flip it: 'That's an area I'm pumped to dive into—similar to when I...'—turns curveballs into wins!")
    return suggestions

def advanced_grammar_analysis(text):
    if not text.strip() or not nlp: return "Grammar: Let's get you started—full sentences help paint the full picture of your awesomeness."
    
    doc = nlp(text)
    sentences = list(doc.sents)
    total_sents = len(sentences)
    if total_sents == 0: return "Grammar: Short and sweet is cool, but let's expand to full sentences—they let your ideas soar!"
    
    issues = []; complexity_score = 0
    
    # Fragments/Vagueness
    for sent in sentences:
        if len(sent) < 6 or not any(token.pos_ == 'VERB' for token in sent):
            issues.append("Quick fragment—beef it up with a verb/action to make it pop.")
    
    # SVA/Tense/Passive
    passive_count = 0
    for token in doc:
        if token.dep_ == 'nsubjpass': passive_count += 1
        if token.dep_ == 'nsubj' and token.head.pos_ == 'VERB':
            subj_num = 'S' if 'NN' in token.tag_ else 'P'
            verb_form = token.head.tag_
            if subj_num == 'P' and 'VBZ' in verb_form:
                issues.append("SVA tweak: Plural subjects love base verbs—'they innovate,' not 'innovates.'")
    
    if passive_count / total_sents > 0.3:
        issues.append(f"Passive polish: {passive_count} spots—flip to active ('I led' vs 'was led') for dynamic punch!")
    
    # Complexity
    for sent in sentences:
        subords = sum(1 for token in sent if token.dep_ in ['ccomp', 'acl:relcl', 'advcl'])
        complexity_score += subords / max(len(sent), 1)
    
    avg_complex = complexity_score / total_sents
    if avg_complex > 0.15: issues.insert(0, f"Grammar strength: Varied flair ({avg_complex:.1%} complex)—keeps 'em hooked!")
    
    # Groq Boost: Vagueness/Flow Quality
    try:
        quality_prompt = f"Analyze vagueness/sentence flow in: '{text[:500]}...' (100 words max). Flag issues; suggest 1 fix. JSON: {{'quality_score': 0-1, 'notes': 'brief note'}}"
        resp = client.chat.completions.create(model="llama3.1-70b-versatile", messages=[{"role": "user", "content": quality_prompt}], max_tokens=100)
        quality_json = json.loads(resp.choices[0].message.content)
        quality_score = quality_json.get('quality_score', 0.7)
        if quality_score < 0.6: issues.append(quality_json.get('notes', 'Tighten vagueness for sharper impact.'))
    except: pass
    
    # Uncertainty
    if any(phrase in text.lower() for phrase in ["don't know", "sorry"]):
        issues.append("Uncertainty vibe—rephrase to 'Eager to explore...' for that confident glow.")
    
    if not issues or "strength" in issues[0].lower():
        return f"Grammar: Spot-on ({total_sents} sentences). {issues[0] if issues else 'Clean, confident structure—nailing it!'}"
    return f"Grammar: Solid base ({total_sents} sentences). Polish: {' | '.join(issues[:3])}—small wins for big impact!"

def detect_fillers(text):
    fillers = re.findall(r'\bum\b|\buh\b|\blike\b|\ber\b|\bbasically\b|\byou know\b', text.lower(), re.IGNORECASE)
    clusters = sum(1 for i in range(len(fillers)-1) if abs(text.lower().find(fillers[i]) - text.lower().find(fillers[i+1])) < 50)
    return len(fillers) + clusters

def generate_expected_keywords(question, question_type):
    try:
        kw_prompt = f"List 5-8 key words/phrases for strong answer to '{question}' ({question_type}). JSON array only."
        resp = client.chat.completions.create(model="llama3.1-70b-versatile", messages=[{"role": "user", "content": kw_prompt}], max_tokens=100)
        return json.loads(resp.choices[0].message.content)
    except:
        fallbacks = {
            'behavioral': ['challenge', 'action', 'result', 'learned', 'team', 'leadership'],
            'strength': ['example', 'impact', 'quantify', 'relevant', 'consistent'],
            'motivation': ['company', 'role', 'growth', 'contribute', 'passion'],
            'default': ['experience', 'skills', 'teamwork', 'challenge']
        }
        return fallbacks.get(question_type, fallbacks['default'])

def compute_keyword_coverage(user_words, expected_keywords):
    """Coverage score: Jaccard + partial matches. user_words is list of lowercased tokens."""
    user_set = set(user_words)  # Already lowercased list from app.py
    matches = sum(1 for kw in expected_keywords if any(word in kw.lower() for word in user_set) or kw.lower() in ' '.join(user_set))
    return matches / len(expected_keywords) if expected_keywords else 0
    
def generate_mock_feedback(transcript, question_type, similarity, fluency=0.85, sentiment='neutral', vocal_fb='Steady delivery.'):
    """
    Human-like, empathetic coach: Warm praise, gentle nudges, actionable gems.
    - Low sim/uncertainty: "Hey, honesty rocks, but let's pivot to shine!"
    - High fluency: "You flowed like a pro—captivating!"
    - Tips: Conversational, encouraging; prioritized by scores (e.g., low sim → relevance nudge).
    """
    if not transcript.strip():
        return ["You're gearing up great—can't wait to hear your voice shine!"], [], ["Pro starter: Smile, breathe, dive in with enthusiasm."]
    
    t_lower = transcript.lower()
    is_uncertain = any(phrase in t_lower for phrase in ["don't know", "sorry", "unsure", "idk"])
    strengths = []
    improvements = []
    mock_tips = []

    # Semantic (real; low for uncertain—encouraging flip)
    if similarity > 0.8:
        strengths.append("You nailed the heart of the question—spot-on and insightful!")
    elif similarity > 0.6:
        strengths.append("Great connection to the query—keeps it relevant and sharp.")
    else:
        improvements.append("Close, but let's laser in: Echo the question early to lock in that 'aha' moment.")
        if is_uncertain:
            improvements[-1] += " (e.g., 'Building on that...' turns 'don't know' into 'eager to grow'—pure gold!)"

    # Fluency (real variation; uncertain tanks it—uplifting nudge)
    adj_fluency = fluency * (0.7 if is_uncertain else 1.0)
    if adj_fluency > 0.85:
        strengths.append("Your flow was magic—smooth, engaging, like a pro storyteller!")
    else:
        improvements.append(f"Fluency glow-up ({adj_fluency:.0%})—sprinkle in natural pauses for that rhythmic vibe.")
        if is_uncertain:
            improvements.append("Hesitation happens—channel it into confident 'hmm, let's think...' for charm!")

    # Vocal (real; warm tie-in)
    if 'steady' in vocal_fb.lower() or 'confident' in vocal_fb.lower():
        strengths.append("Voice game strong—warm, assured, draws folks in!")
    else:
        improvements.append(f"Vocal sparkle: {vocal_fb.split('.')[0]}—add a touch of inflection for extra warmth.")

    # Sentiment (real; boosts positives, lifts lows)
    if sentiment == 'positive':
        strengths.append("That enthusiasm? Infectious—interviewers eat it up!")
    elif sentiment == 'neutral':
        mock_tips.append("One nudge: Weave in 'excited by'—turns good into magnetic!")
    else:
        improvements.append("Tone tweak: Frame with 'optimistic about'—radiates that winning optimism!")

    # Grammar (real; encouraging on issues)
    grammar_str = advanced_grammar_analysis(transcript)
    if "Spot-on" in grammar_str or "Grammar strength" in grammar_str:
        strengths.append("Grammar finesse—polished and persuasive, like a natural!")
    else:
        g_nudge = grammar_str.split("Polish: ")[-1] if "Polish:" in grammar_str else "flow tweaks."
        improvements.append(f"Grammar finesse: {g_nudge}—tiny shifts for seamless sparkle.")

    # Fillers (real; gentle on highs)
    fillers = len(re.findall(r'\bum\b|\buh\b|\blike\b|\ber\b', t_lower, re.IGNORECASE))
    adj_fillers = fillers + (2 if is_uncertain else 0)
    if adj_fillers < 2:
        strengths.append("Filler-free zone—crisp, confident, crowd-pleaser!")
    else:
        improvements.append(f"Pause power: {adj_fillers} fillers snuck in—trade 'em for breath; it's your secret weapon!")

    # Mock Tips (natural, coach-like; 3 max, prioritized by lows + type)
    tips_by_type = {
        'intro': [
            "Nail the opener: 'Currently [role], thrilled by [win], perfect for your team'—under 90s, boom!",
            "Story arc: Past spark → Present passion → Future fit—hooks 'em instantly.",
            "Pro close: 'Eager to chat more'—leaves 'em wanting your vibe!"
        ],
        'strength': [
            "Example magic: 'Strength + quick story + 25% win = unforgettable.'",
            "Role sync: 'This shines for your fast-paced world—let's dive deeper?'",
            "Sweet spot: 2-3 tailored; quantify for 'wow' factor."
        ],
        'weakness': [
            "Growth glow: 'Once tripped on X, now crush it with Y—boom, stronger!'",
            "Honest charm: Share real, end with 'excited to build on it here.'",
            "Dodge traps: Skip 'perfectionist'—go authentic for authenticity points."
        ],
        'motivation': [
            "Heart + hustle: 'Your mission fires me up—my [skill] fits like a glove.'",
            "Beyond basics: 'Growth + impact' > generic; probe 'What drives your stars?'",
            "Connect dots: Link to their 'why'—shows you've done homework!"
        ],
        'career': [
            "Vision vibe: 'Lead here, scaling your innovations—optimistic match!'",
            "Real + reachable: Promotions + contributions, not 'top dog'—grounded wins hearts.",
            "Ask back: 'How do you fuel 5-year dreams?'—flips to dialogue."
        ],
        'work-style': [
            "Flex flow: 'Team brainstorm queen, solo deep-dive dynamo—best of both!'",
            "Live it: 'In sprints, sync daily; audits, accelerate solo.'",
            "Mirror magic: Echo their culture—'Thrives in your dynamic buzz.'"
        ],
        'behavioral': [
            "STAR superstar: 15% Set scene, 55% Your moves, 30% Win (numbers!).",
            "Bite-sized: 90s max; 'Honed my hustle for next-level challenges here.'",
            "Wisdom wrap: 'Key takeaway? Optimism turns setbacks to setups!'"
        ],
        'experience': [
            "Silver linings: 80% gems, 20% lessons—no shade, all shade-throwing growth.",
            "Bridge bright: 'Powered my pivot to your world of wonder.'",
            "Pro polish: Narrative of ascent—interviewers root for your rise!"
        ],
        'company-fit': [
            "Fit flair: 'Your ethos? My jam—let's co-create magic!'",
            "Value vault: 'Fit + flair: My edge amps your mission.'",
            "Curious connect: 'How's team living this daily?'—sparks convo."
        ],
        'company-specific': [
            "Insight ignite: 'Q3 win wows—my APIs turbocharge v2!'",
            "Pain-point pro: 'Targeting retention? My ML magic delivers.'",
            "Standout spark: 'Peers miss my [exp]—ready to rock your revolution!'"
        ],
        'achievement': [
            "Win wow: '40% leap via A/B—team triumph, my spark!'",
            "Humble hype: 'Collaborated crush; my piece: Pivotal pivot.'",
            "Relevance rocket: 'Fueled my fire for [role's] bold horizons.'"
        ],
        'default': [
            "Body bliss: Open stance, warm smile—your natural charisma shines!",
            "Rhythm rock: 130 wpm, comma breaths—flow like a fireside chat.",
            "Anchor awesome: 'Wrapping up...'—leaves 'em hooked on your horizon!"
        ]
    }
    
    tip_set = tips_by_type.get(question_type, tips_by_type['default'])
    selected_tips = []
    # Prioritize by lows (real conditional)
    if fluency < 0.75:
        pacing_tip = next((t for t in tip_set if any(word in t.lower() for word in ['pace', 'rhythm', 'flow'])), tip_set[0])
        selected_tips.append(pacing_tip)
    if similarity < 0.6:
        relevance_tip = next((t for t in tip_set if any(word in t.lower() for word in ['relevance', 'focus', 'connect'])), tip_set[0])
        selected_tips.append(relevance_tip)
    if is_uncertain:
        confidence_tip = next((t for t in tip_set if any(word in t.lower() for word in ['confidence', 'pivot', 'growth'])), "Flip uncertainty: 'Eager to explore—much like my [win]!'")
        selected_tips.append(confidence_tip)
    # Varied add-ons
    remaining = [t for t in tip_set if t not in selected_tips]
    selected_tips += random.sample(remaining or tip_set, min(1, len(remaining or tip_set)))
    mock_tips = selected_tips[:3]  # Cap at 3 for focus

    return strengths, improvements, mock_tips

def generate_discussion_reply(topic, user_input, conversation):
    # Unchanged (as per request)
    context = ' '.join([msg['text'] for msg in conversation[-3:] if msg['role'] == 'user'])
    full_context = f"Topic: {topic}. Recent discussion: {context}. User said: {user_input}."

    topic_templates = {
        'Global Warming': 'Your insight on emissions is compelling—global warming demands urgent action. How do you see individual actions contributing alongside policy changes?',
        'AI Ethics': 'Ethics in AI is pivotal; addressing bias in {user_input} aligns with diverse datasets. What ethical framework would you advocate for AI governance?',
        'Remote Work Challenges': 'Remote work boosts flexibility but {user_input} highlights isolation risks. What strategies have you found effective for virtual team bonding?',
        'Work-Life Balance': 'Balancing work-life is key; your point on boundaries resonates. How can companies better support employee wellness in hybrid setups?',
        'Diversity in Workplace': 'Diversity drives innovation—{user_input} underscores inclusive hiring. What metrics would you use to measure DEI progress?',
        'Sustainable Business': 'Sustainability in business is essential; tying it to {user_input} shows foresight. How can SMEs adopt green practices affordably?',
        'Mental Health at Work': 'Mental health awareness is growing; {user_input} on stigma reduction is spot-on. What role should managers play in fostering open conversations?',
        'Gig Economy': 'The gig economy offers freedom but {user_input} notes instability. How might universal basic income mitigate these risks?',
        'Leadership in Crisis': 'Crisis leadership requires calm; your example in {user_input} exemplifies resilience. What’s one lesson from past crises you’d apply today?',
        'Innovation in Education': 'Edtech innovation excites—{user_input} on personalized learning is forward-thinking. How can we bridge the digital divide in classrooms?',
        'Cybersecurity Threats': 'Cyber threats evolve rapidly; addressing {user_input} via zero-trust models is wise. What emerging tech do you see countering AI-driven attacks?',
        'Gender Equality': 'Gender equality advances slowly; {user_input} on pay gaps highlights urgency. What policy changes would accelerate workplace parity?',
        'Climate Change Solutions': 'Solutions to climate change must scale; your focus on {user_input} is practical. How can grassroots movements influence corporate shifts?',
        'Digital Privacy': 'Privacy in the digital age is fragile—{user_input} on data rights is crucial. Should governments mandate privacy-by-design for all apps?',
        'Future of Jobs': 'Jobs are transforming with AI; {user_input} on reskilling is vital. Which sectors do you predict will thrive in the next decade?'
    }
    
    fallback = f"That's a thoughtful take on {topic}. Building on {user_input}, let's explore potential solutions—what's one step we could take next?"
    
    reply = topic_templates.get(topic, fallback)
    
    if len(conversation) > 1:
        reply = f"{reply.split('.')[0]}. Earlier, you mentioned {context[-50:] if context else 'challenges'}. How does that connect?"
    
    return reply.format(user_input=user_input[:30] + '...' if len(user_input) > 30 else user_input)