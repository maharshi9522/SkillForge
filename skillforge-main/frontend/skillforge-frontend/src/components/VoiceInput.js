// Note: VoiceInput.js can be a standalone for reusable speech, but since MockInterview already handles webkitSpeechRecognition,
// consider merging: Export recognition logic from here and import into MockInterview. Placeholder below.

import React, { useState, useEffect, useRef } from 'react';

const VoiceInput = ({ onTranscript, onConfidence }) => {
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const recognitionRef = useRef(null);
  const isRunningRef = useRef(false);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-IN';

      rec.onresult = (event) => {
        let interim = '';
        let final = transcript;
        let totalConf = 0;
        let confCount = 0;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i][0];
          const chunk = result.transcript.trim();
          if (chunk) {
            if (event.results[i].isFinal) {
              final += ' ' + chunk;
              totalConf += result.confidence;
              confCount++;
            } else {
              interim += ' ' + chunk;
            }
          }
        }
        if (confCount > 0) setConfidence(totalConf / confCount);
        setInterimTranscript(interim);
        setTranscript(final);
        onTranscript?.(final + (interim ? ' ' + interim : ''));
        onConfidence?.(confidence);
      };

      rec.onerror = (e) => console.error('Voice error:', e.error);
      rec.onend = () => {
        isRunningRef.current = false;
        // Auto-restart if needed
        setTimeout(() => {
          if (!isRunningRef.current) {
            rec.start();
            isRunningRef.current = true;
          }
        }, 300);
      };

      recognitionRef.current = rec;
      rec.start();
      isRunningRef.current = true;

      return () => rec.stop();
    }
  }, [transcript]);

  return (
    <div>
      <p>Interim: {interimTranscript}...</p>
      <p>Final: {transcript}</p>
      <p>Confidence: {(confidence * 100).toFixed(0)}%</p>
    </div>
  );
};

export default VoiceInput;