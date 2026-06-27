// src/utils/logActivity.js
// New: Helper to log activities from Mock/Aptitude/Soft Skills tabs.

import api from './axios'; // Your JWT-enabled instance

export const logActivity = async (type, id, score) => {
  try {
    await api.post('/api/progress/complete', { 
      activityType: type, 
      activityId: id, 
      score 
    });
    console.log(`Activity "${type}" logged with score ${score}. Check Profile for updates!`);
  } catch (err) {
    console.error('Failed to log activity:', err);
    // Optional: Show toast/error in UI
  }
};