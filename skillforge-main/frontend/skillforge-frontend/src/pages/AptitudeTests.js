import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import api from '../utils/axios';
import { useNavigate } from 'react-router-dom';

const AptitudeTests = () => {

    const navigate = useNavigate();

    const [allQuestions, setAllQuestions] = useState([]);
    const [testQuestions, setTestQuestions] = useState([]);
    const [current, setCurrent] = useState(0);
    const [score, setScore] = useState(0);

    const [feedback, setFeedback] = useState('');
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastIsCorrect, setLastIsCorrect] = useState(false);

    const [topicStats, setTopicStats] = useState({});
    const [analytics, setAnalytics] = useState(null);
    const [showAnalytics, setShowAnalytics] = useState(false);

    const [isTestActive, setIsTestActive] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [timeLeft, setTimeLeft] = useState(1800);
    const [isTimerRunning, setIsTimerRunning] = useState(false);

    const [answeredCount, setAnsweredCount] = useState(0);
    const [completedQuestions, setCompletedQuestions] = useState(new Set());
    const [pastTests, setPastTests] = useState([]);

    const userId = sessionStorage.getItem('user');

    // ------------------------------
    // Redirect if NOT logged in
    // ------------------------------
    useEffect(() => {
        if (!userId) navigate('/login');
    }, [navigate, userId]);

    // ------------------------------
    // Load JSON question bank
    // ------------------------------
    useEffect(() => {
        axios.get('/data/aptitude.json')
            .then(res => {
                // clean JSON and ensure all questions have id & options
                const cleaned = res.data.filter(q =>
                    q.id &&
                    Array.isArray(q.options) &&
                    q.options.length === 4 &&
                    typeof q.correct_index === "number"
                );
                setAllQuestions(cleaned);
            })
            .catch(err => console.error("❌ Failed to load JSON:", err));
    }, []);

    // ------------------------------
    // Fetch user completed progress
    // ------------------------------
    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        if (!userId) return;

        try {
            const res = await api.get(`/api/progress/profile/${userId}`);
            const progress = res.data.progress || [];

            const completedIds = progress
                .filter(p => p.activity_type === 'aptitude')
                .map(p => Number(p.activity_id));

            setCompletedQuestions(new Set(completedIds));

            const aptitudeTests = progress
                .filter(p => p.activity_type === 'aptitude-test')
                .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
                .map((test, index) => ({
                    ...test,
                    test_number: index + 1
                }));

            setPastTests(aptitudeTests);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };


    // ------------------------------
    // Timer Logic
    // ------------------------------
    useEffect(() => {
        if (!isTimerRunning || timeLeft <= 0) return;

        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { completeTest(false); return 0; }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isTimerRunning, timeLeft]);

    const formatTime = seconds =>
        `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;


    // ------------------------------
    // Fisher–Yates Shuffle
    // ------------------------------
    const shuffleQuestions = arr => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    };


    // ------------------------------
    // Start Test – 30 Random NON-Repeating
    // ------------------------------
    const startNewTest = () => {
        if (allQuestions.length < 30) {
            alert("Not enough questions in question bank");
            return;
        }

        // random ANY 30 questions
        const selected = shuffleQuestions(allQuestions).slice(0, 30);

        setTestQuestions(selected);
        setCurrent(0);
        setScore(0);
        setAnsweredCount(0);

        setTopicStats({});
        setAnalytics(null);

        setFeedback("");
        setShowFeedback(false);

        setIsTestActive(true);
        setTimeLeft(1800);
        setIsTimerRunning(true);
    };


    // ------------------------------
    // Answer Question
    // ------------------------------
    const handleAnswer = async (index) => {
        const q = testQuestions[current];

        const correct = index === q.correct_index;
        const points = correct ? 100 : 0;

        setScore(prev => prev + points);
        setAnsweredCount(prev => prev + 1);

        setLastIsCorrect(correct);
        setFeedback(correct
            ? "Correct!"
            : `Wrong. Correct answer: ${q.options[q.correct_index]}`
        );
        setShowFeedback(true);

        // topic stats
        const chapter = q.chapter || "General";

        setTopicStats(prev => ({
            ...prev,
            [chapter]: {
                total: (prev[chapter]?.total || 0) + 1,
                correct: (prev[chapter]?.correct || 0) + (correct ? 1 : 0)
            }
        }));

        // save progress
        try {
            await api.post("/api/progress/complete", {
                activityType: "aptitude",
                activityId: q.id,
                score: points
            });
        } catch (err) {
            console.error(err);
        }
    };


    // ------------------------------
    // Next Question
    // ------------------------------
    const handleNext = () => {
        if (current < 29) {
            setCurrent(prev => prev + 1);
            setShowFeedback(false);
            setFeedback('');
        } else {
            completeTest(false);
        }
    };


    const completeTest = async () => {
        setIsTimerRunning(false);

        const attempted = answeredCount;
        const correct = score / 100;
        const wrong = attempted - correct;
        const unattempted = 30 - attempted;
        const timeTaken = 1800 - timeLeft;

        // Build clean topic performance summary
        const topics = Object.entries(topicStats).map(([topic, data]) => {
            const accuracy = data.total ? Math.round((data.correct / data.total) * 100) : 0;
            return {
                topic,
                total: data.total,
                correct: data.correct,
                accuracy
            };
        });

        // Sort by accuracy descending → clean & neat listing
        const sortedTopics = topics.sort((a, b) => b.accuracy - a.accuracy);

        // Strong = accuracy >= 70
        const strongAreas = sortedTopics
            .filter(t => t.accuracy >= 70)
            .map(t => `${t.topic} (${t.accuracy}%)`);

        // Weak = accuracy <= 40
        const weakAreas = sortedTopics
            .filter(t => t.accuracy <= 40)
            .map(t => `${t.topic} (${t.accuracy}%)`);

        const analyticsData = {
            totalScore: score,
            percentage: Math.round((score / 3000) * 100),
            correct,
            wrong,
            unattempted,
            timeTaken,
            timeTakenFormatted: `${Math.floor(timeTaken / 60)}m ${timeTaken % 60}s`,

            topicsCovered: sortedTopics.map(t => t.topic),
            topicPerformance: sortedTopics,

            strongAreas: strongAreas.length ? strongAreas : ["No strong topics yet"],
            weakAreas: weakAreas.length ? weakAreas : ["None — Good job"],

            avgTopicAccuracy: sortedTopics.length
                ? Math.round(sortedTopics.reduce((sum, t) => sum + t.accuracy, 0) / sortedTopics.length)
                : 0
        };

        setAnalytics(analyticsData);
        setShowAnalytics(true);
        setIsTestActive(false);

        // save the test analytics
        try {
            await api.post("/api/progress/complete", {
                activityType: "aptitude-test",
                activityId: `test_${Date.now()}`,
                score,
                details: { analytics: analyticsData }
            });
            fetchProfile();
        } catch (err) {
            console.error(err);
        }
    };


    // ---------------------------------------
    // UI SECTION (FULL FINAL WORKING)
    // ---------------------------------------
    const progress = testQuestions.length ? ((current + 1) / 30) * 100 : 0;
    const q = testQuestions[current];

    if (isLoading) return <div className="loading">Loading...</div>;


    return (
        <>
            <motion.section className="aptitude-mastery">
                <div className="header-gradient">
                    <motion.h1 initial={{ y: -50 }} animate={{ y: 0 }}>Aptitude Mastery</motion.h1>
                    <p>30 Questions • 30 Minutes • 3000 Points Max</p>
                </div>

                {/* Space between past tests and main box */}
                <div style={{ height: '4rem' }}></div>

                {pastTests.length > 0 && (
                    <div className="past-tests-grid">
                        <h3>Your Journey So Far</h3>
                        <div className="cards-container">
                            {pastTests.slice(0, 6).reverse().map((test, i) => (
                                <motion.div key={i} className="past-test-card">
                                    <div className="card-header">
                                        <span>Test #{test.test_number}</span>
                                        <span className={`badge ${test.score >= 2400 ? 'gold' : test.score >= 1800 ? 'silver' : 'bronze'}`}>
                                            {test.score}/3000
                                        </span>
                                    </div>
                                    <p>{new Date(test.completed_at).toLocaleDateString()}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ADD THIS LINE ONLY */}
                <div style={{ height: '100px' }}></div>
                {/* ↑ Creates nice space between past tests and Start Test box */}

                <div className="test-container">
                    {!isTestActive ? (
                        <motion.div className="welcome-card">
                            <h2>Ready to Level Up?</h2>
                            <p>30 fresh questions • Real-time analytics</p>
                            <motion.button className="start-btn-big" onClick={startNewTest}>
                                Start Test
                            </motion.button><br></br>
                            <small>{allQuestions.length - completedQuestions.size} questions left</small>
                        </motion.div>
                    ) : (
                        <>
                            <div className="top-bar">
                                <div className="timer-display" style={{ color: timeLeft <= 120 ? '#ef4444' : timeLeft <= 300 ? '#f59e0b' : '#10b981' }}>
                                    {formatTime(timeLeft)}
                                </div>
                                <div>Score: <strong>{score}</strong>/3000</div>
                            </div>

                            <div className="progress-bar-container">
                                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                                <span className="progress-label">Q{current + 1}/30</span>
                            </div>

                            <motion.div key={current} className="question-box">
                                <h3>Q{current + 1}. {q.question}</h3>

                                {!showFeedback ? (
                                    <div className="options-grid">
                                        {q.options?.map((opt, i) => (
                                            <motion.button key={i} className="option-card" onClick={() => handleAnswer(i)}>
                                                <span className="letter">{['A', 'B', 'C', 'D'][i]}</span>
                                                <span>{opt}</span>
                                            </motion.button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="feedback-box">
                                        <div className={`feedback-bubble ${lastIsCorrect ? 'correct' : 'wrong'}`}>
                                            <p>{feedback}</p>
                                        </div>
                                        <motion.button className="next-btn-fancy" onClick={handleNext}
                                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                            {current < 29 ? 'Next' : 'See Results'}
                                        </motion.button>
                                    </div>
                                )}
                            </motion.div>

                            <button onClick={() => completeTest(true)} className="end-early-btn">
                                End Test Early
                            </button>
                        </>
                    )}
                </div>

                {/* CLEAN ANALYTICS MODAL — Simple hover animation only on button */}
                <AnimatePresence>
                    {showAnalytics && analytics && (
                        <motion.div className="modal-overlay" onClick={() => setShowAnalytics(false)}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <motion.div className="analytics-modal" onClick={e => e.stopPropagation()}
                                initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }}>
                                <h2>Test Complete!</h2>
                                <div className="result-highlight">
                                    <h1>{analytics.percentage}%</h1>
                                    <p>{analytics.correct} Correct • {analytics.wrong} Wrong • {analytics.unattempted} Unattempted</p>
                                </div>

                                <div className="stats-grid">
                                    <div className="stat-item"><span>Time</span><strong>{analytics.timeTakenFormatted}</strong></div>
                                    <div className="stat-item"><span>Accuracy</span><strong>{analytics.avgTopicAccuracy}%</strong></div>
                                    <div className="stat-item"><span>Topics</span><strong>{analytics.topicsCovered.length}</strong></div>
                                </div>

                                <div className="topic-analysis">
                                    <h3>Strong Areas</h3>
                                    <div className="topic-tags">
                                        {analytics.strongAreas.map((t, i) => <span key={i} className="tag strong">{t}</span>)}
                                    </div>
                                    <h3>Needs Improvement</h3>
                                    <div className="topic-tags">
                                        {analytics.weakAreas.map((t, i) => <span key={i} className="tag weak">{t}</span>)}
                                    </div>
                                </div>

                                <motion.button className="close-btn" onClick={() => setShowAnalytics(false)}
                                    whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}>
                                    Close & Continue
                                </motion.button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.section>

            <style jsx>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

        .aptitude-mastery { min-height: 100vh; padding: 2rem 1rem; background: linear-gradient(135deg, #1e1a36, #140e44, #4a4e78); color: white; }
        .header-gradient { text-align: center; padding: 3rem; background: rgba(255,255,255,0.15); border-radius: 30px; backdrop-filter: blur(10px); margin-bottom: 2rem; }
        h1 { font-size: 3.5rem; background: linear-gradient(45deg, #fff, #ffd0d0); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; font-weight: 700; }
        .past-tests-grid h3 { text-align: center; font-size: 1.8rem; margin-bottom: 1.5rem; }
        .cards-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; padding: 0 1rem; }
        .past-test-card { background: white; color: #333; padding: 1.5rem; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); transition: transform 0.3s; }
        .past-test-card:hover { transform: translateY(-10px); }
        .card-header { display: flex; justify-content: space-between; margin-bottom: 0.8rem; }
        .trophy { font-weight: 600; color: #667eea; }
        .badge { padding: 0.4rem 0.8rem; border-radius: 50px; font-weight: 700; font-size: 0.9rem; }
        .gold { background: #ffd700; color: #b8860b; }
        .silver { background: #e0e0e0; color: #666; }
        .bronze { background: #cd7f32; color: white; }

        .test-container { max-width: 900px; margin: 0 auto; background: white; color: #333; border-radius: 30px; padding: 2.5rem; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
        .welcome-card { text-align: center; padding: 4rem 2rem; background: linear-gradient(135deg, #1a2242, #252039); border-radius: 30px; color: white; }
        .welcome-card h2 { font-size: 2.8rem; margin-bottom: 1rem; }
        .start-btn-big { background: white; color: #764ba2; padding: 1.2rem 3rem; font-size: 1.4rem; font-weight: 700; border-radius: 50px; cursor: pointer; box-shadow: 0 10px 30px rgba(0,0,0,0.2); margin: 1.5rem 0; }
        .top-bar { display: flex; justify-content: space-between; background: #f8f9fa; padding: 1rem 1.5rem; border-radius: 15px; margin-bottom: 1.5rem; font-weight: 600; font-size: 1.3rem; }
        .timer-display { font-size: 1.8rem; font-weight: 700; }
        .progress-bar-container { background: #e0e0e0; height: 12px; border-radius: 6px; overflow: hidden; margin-bottom: 2rem; position: relative; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); transition: width 0.6s ease; }
        .progress-label { position: absolute; top: -30px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); color: white; padding: 0.3rem 1rem; border-radius: 20px; font-size: 0.9rem; }
        .question-box { background: #f8f9fa; border-radius: 20px; padding: 2.5rem; box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
        .question-box h3 { font-size: 1.7rem; margin-bottom: 2rem; line-height: 1.5; }
        .options-grid { display: grid; gap: 1.2rem; }
        .option-card { background: white; border: 3px solid #e0e0e0; border-radius: 16px; padding: 1.4rem; display: flex; align-items: center; gap: 1rem; cursor: pointer; transition: all 0.3s; font-size: 1.15rem; }
        .option-card:hover { border-color: #667eea; transform: translateX(10px); box-shadow: 0 8px 25px rgba(102,126,234,0.2); }
        .letter { background: #667eea; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
        .feedback-bubble { padding: 1.5rem; border-radius: 20px; margin-bottom: 2rem; font-size: 1.3rem; font-weight: 600; }
        .correct { background: #d4edda; color: #155724; border: 2px solid #28a745; }
        .wrong { background: #f8d7da; color: #721c24; border: 2px solid #dc3545; }
        .next-btn-fancy { background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 1rem 2.5rem; border: none; border-radius: 50px; font-size: 1.3rem; cursor: pointer; }
        .end-early-btn { background: #dc3545; color: white; padding: 0.8rem 2rem; border: none; border-radius: 50px; cursor: pointer; margin-top: 1rem; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .analytics-modal { background: white; color: #333; border-radius: 30px; padding: 3rem; max-width: 600px; width: 90%; box-shadow: 0 30px 80px rgba(0,0,0,0.5); }
        .result-highlight h1 { font-size: 6rem; margin: 0; background: linear-gradient(45deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin: 2rem 0; }
        .stat-item { background: #f8f9fa; padding: 1.5rem; border-radius: 16px; text-align: center; }
        .stat-item span { display: block; color: #666; font-size: 0.9rem; }
        .stat-item strong { font-size: 1.8rem; color: #333; margin-top: 0.5rem; display: block; }
        .topic-analysis h3 { margin: 2rem 0 1rem; color: #333; font-size: 1.4rem; }
        .topic-tags { display: flex; flex-wrap: wrap; gap: 0.8rem; }
        .tag { padding: 0.6rem 1.2rem; border-radius: 50px; font-weight: 600; font-size: 0.95rem; }
        .tag.strong { background: #d4edda; color: #155724; }
        .tag.weak { background: #f8d7da; color: #721c24; }
        .close-btn { background: #667eea; color: white; padding: 1rem 2.5rem; border: none; border-radius: 50px; font-size: 1.2rem; cursor: pointer; margin-top: 2rem; }

        @media (max-width: 768px) {
          h1 { font-size: 2.8rem; }
          .stats-grid { grid-template-columns: 1fr; }
          .cards-container { grid-template-columns: 1fr; }
      `}</style>
        </>
    );
};

export default AptitudeTests;