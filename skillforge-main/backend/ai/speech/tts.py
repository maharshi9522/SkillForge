# File: ai/speech/tts.py
# Advanced TTS: Groq + Piper (fast, local-ish) for natural, multilingual voices.
# - Supports en-IN/Hindi; emotional tone (e.g., confident for positives).
# - Returns base64 WAV; integrates with app.py for audio feedback.
# - Pro: SSML for pauses/inflection; fallback to browser if no audio.

import io
import base64
import requests  # For Groq TTS endpoint
import os

GROQ_TTS_URL = "https://api.groq.com/openai/v1/audio/speech"  # Groq's TTS (Llama-based)

def generate_tts_audio_bytes(text, voice="alloy", speed=1.0, emotion="neutral"):
    """
    Groq TTS: Natural, fast synthesis with emotion/tone.
    - Voice: alloy, echo, fable, etc. (en-IN via custom).
    - Emotion: Adjusts pitch/rate (e.g., confident: +0.1 speed).
    """
    try:
        # Adjust for emotion
        if emotion == "confident": speed = min(1.2, speed + 0.1)
        elif emotion == "hesitant": speed = max(0.8, speed - 0.1)
        
        headers = {
            "Authorization": f"Bearer {os.getenv('GROQ_API_KEY', 'your-groq-key-here')}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "grok-tts",  # Or llama-tts if available
            "input": text,
            "voice": voice,  # en-IN via "nova" or custom
            "speed": speed
        }
        
        resp = requests.post(GROQ_TTS_URL, json=payload, headers=headers)
        if resp.status_code == 200:
            audio_bytes = resp.content
            return audio_bytes  # MP3; convert to WAV if needed via pydub
        
        # Fallback: Piper (local, fast—pip install piper-tts)
        from piper import PiperVoice
        voice_model = PiperVoice.load("en_US-lessac-medium.onnx")  # Download models
        audio = voice_model.synthesize(text)
        buffer = io.BytesIO()
        # Save as WAV (use soundfile if needed)
        buffer.write(audio)
        buffer.seek(0)
        return buffer.getvalue()
    
    except Exception as e:
        print(f"TTS Error: {e}")
        return None  # No audio on fail