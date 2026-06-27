import React from 'react';
import { Typography } from '@mui/material';

const FeedbackDisplay = ({ feedback }) => {
  return (
    <div style={{ marginTop: '20px' }}>
      <Typography variant="h6">Feedback</Typography>
      <Typography>Clarity: {feedback.clarity || 'N/A'}</Typography>
      <Typography>Sentiment: {feedback.sentiment || 'N/A'}</Typography>
      <Typography>Professionalism: {feedback.professionalism || 'N/A'}</Typography>
      {feedback.confidence && <Typography>Confidence: {feedback.confidence}</Typography>}
      {feedback.note && <Typography>{feedback.note}</Typography>}
      {feedback.error && <Typography color="error">{feedback.error}</Typography>}
    </div>
  );
};

export default FeedbackDisplay;