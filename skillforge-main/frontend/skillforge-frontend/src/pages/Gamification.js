// src/pages/Gamification.js
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    FaCoins, FaStar, FaTrophy, FaCrown, FaBrain, FaMedal, FaFire
} from 'react-icons/fa';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip
} from 'chart.js';
import api from '../utils/axios';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const Gamification = () => {
    const [coins, setCoins] = useState(0);
    const [level, setLevel] = useState(1);
    const [practiceQuestions, setPracticeQuestions] = useState(0); // Personal stats: Practice Qs
    const [activeDays, setActiveDays] = useState(0);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);

    const userId = sessionStorage.getItem('user') || 'guest';
    const VISIT_KEY = `skillforge_gamification_visited_${userId}`;

    const allBadges = [
        { name: "First Step", desc: "Solve your first question", req: 1, icon: FaTrophy },
        { name: "Getting Started", desc: "Solve 10 questions", req: 10, icon: FaStar },
        { name: "Dedicated Learner", desc: "Solve 50 questions", req: 50, icon: FaBrain },
        { name: "Practice Makes Perfect", desc: "Solve 100 questions", req: 100, icon: FaMedal },
        { name: "Aptitude Pro", desc: "Solve 250 questions", req: 250, icon: FaFire },
        { name: "3-Day Active", desc: "Be active for 3 days", req: 3, type: "active", icon: FaFire },
        { name: "Week Warrior", desc: "Be active for 7 days", req: 7, type: "active", icon: FaFire },
        { name: "Unstoppable", desc: "Be active for 15 days", req: 15, type: "active", icon: FaFire },
    ];

    const fetchData = async () => {
        try {
            setLoading(true);
            const [profileRes, lbRes] = await Promise.all([
                api.get('/api/progress/profile/me'),
                api.get('/api/progress/leaderboard')
            ]);

            const progress = profileRes.data.progress || [];

            // Personal: Practice Questions only (same as Profile.js doughnut)
            // FIXED: Match Profile.js logic 1:1
            const aptitudeEntries = progress.filter(p =>
                ['aptitude', 'aptitude-test'].includes(p.activity_type)
            );

            const fullTests = aptitudeEntries.filter(p => p.activity_type === 'aptitude-test').length;

            // Practice questions = aptitude entries – full tests
            const practiceQuestionsCount = Math.max(aptitudeEntries.length - fullTests, 0);



            // Active Days (unique days with aptitude activity)
            const dates = progress
                .filter(p => ['aptitude', 'aptitude-test'].includes(p.activity_type))
                .map(p => p.completed_at ? new Date(p.completed_at).toISOString().split('T')[0] : null)
                .filter(Boolean);
            const uniqueDays = [...new Set(dates)].length;

            // Update personal stats
            setPracticeQuestions(practiceQuestionsCount);
            setActiveDays(uniqueDays);
            setLevel(Math.floor(practiceQuestionsCount / 10) + 1);
            setLeaderboard(lbRes.data || []);

            // Coins logic (based on practice questions)
            const coinKey = `skillforge_coins_${userId}`;
            const lastVisit = localStorage.getItem(VISIT_KEY);
            let currentCoins = parseInt(localStorage.getItem(coinKey) || '0', 10);

            if (!localStorage.getItem(coinKey)) {
                if (practiceQuestionsCount > 30) currentCoins = 250;
                else if (practiceQuestionsCount > 20) currentCoins = 100;
            }

            const today = Date.now().toString();
            if (lastVisit !== today) {
                currentCoins += 50;
                localStorage.setItem(VISIT_KEY, today);
            }

            setCoins(currentCoins);
            localStorage.setItem(coinKey, currentCoins.toString());

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const chartData = {
        labels: ['Questions Solved', 'Active Days'],
        datasets: [{
            label: 'Your Progress',
            data: [practiceQuestions, activeDays],
            backgroundColor: ['#8b5cf6', '#f97316'],
            borderRadius: 10,
        }]
    };

    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
    const itemVariants = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

    const unlockedBadges = allBadges.filter(badge =>
        badge.type === "active" ? activeDays >= badge.req : practiceQuestions >= badge.req
    );

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '5rem', color: '#ccc' }}>
                <FaTrophy size={70} className="animate-pulse" />
                <p>Loading your achievements...</p>
            </div>
        );
    }

    return (
        <motion.section className="section gamification-section"
            variants={containerVariants} initial="hidden" animate="visible">

            <div className="gamification-header">
                <h2>Your SkillForge Journey</h2>
                <p>Earn +50 coins every visit • Track Active Days • Unlock badges</p>
            </div>

            {/* Personal Stats - Practice Questions */}
            <div className="gamification-stats-overview">
                <motion.div className="stat-card" variants={itemVariants} whileHover={{ scale: 1.08 }}>
                    <FaCoins size={40} color="#fbbf24" />
                    <h3>{coins.toLocaleString()}</h3>
                    <p>Coins Earned</p>
                    <small style={{ color: '#10b981', fontWeight: 'bold' }}>+50 visit bonus!</small>
                </motion.div>

                <motion.div className="stat-card" variants={itemVariants} whileHover={{ scale: 1.08 }}>
                    <FaStar size={40} color="#c084fc" />
                    <h3>Level {level}</h3>
                    <p>{10 - (practiceQuestions % 10)} to next</p>
                </motion.div>

                <motion.div className="stat-card" variants={itemVariants} whileHover={{ scale: 1.08 }}>
                    <FaFire size={40} color="#f97316" />
                    <h3>{activeDays} Days</h3>
                    <p>Active Days</p>
                </motion.div>

                <motion.div className="stat-card" variants={itemVariants} whileHover={{ scale: 1.08 }}>
                    <FaBrain size={40} color="#8b5cf6" />
                    <h3>{practiceQuestions}</h3>
                    <p>Questions Solved</p>
                </motion.div>
            </div>

            {/* Chart - Practice Questions */}
            <motion.div className="progress-wrapper" variants={itemVariants}>
                <h3>Your Growth</h3>
                <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
            </motion.div>

            {/* Leaderboard - "Questions Solved" = Streak Days */}
            <motion.div className="leaderboard-section" variants={itemVariants}>
                <h3>Global Leaderboard</h3>
                {leaderboard.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#999' }}>Be the first to rank!</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                            <thead>
                                <tr style={{ background: '#1f2937', color: '#e5e7eb' }}>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>Rank</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>User</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>Questions Solved</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.slice(0, 10).map((u, i) => (
                                    <motion.tr key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                            {i < 3 ? <FaCrown color={i === 0 ? 'gold' : i === 1 ? 'silver' : '#cd7f32'} /> : i + 1}
                                        </td>
                                        <td style={{ padding: '12px' }}>{u.username || 'Anonymous'}</td>
                                        <td style={{ textAlign: 'center', color: '#f97316', fontWeight: 'bold' }}>
                                            {u.streak_days || 0} {/* Now shows Streak Days */}
                                        </td>
                                        <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 'bold' }}>
                                            {u.rank_score || 0}
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>

            {/* Badges - Based on Practice Questions */}
            <motion.div className="unlocked-badges-showcase" variants={itemVariants}>
                <h3>Your Unlocked Badges ({unlockedBadges.length})</h3>
                <div className="unlocked-badges-grid">
                    {unlockedBadges.length > 0 ? (
                        unlockedBadges.map((badge, i) => (
                            <motion.div key={i} className="unlocked-badge" whileHover={{ scale: 1.2 }}>
                                <badge.icon size={48} color="#10b981" />
                                <p><strong>{badge.name}</strong></p>
                            </motion.div>
                        ))
                    ) : (
                        <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#aaa' }}>
                            Start practicing to unlock badges!
                        </p>
                    )}
                </div>
            </motion.div>

            {/* All Badges */}
            <motion.div className="all-badges-compact" variants={itemVariants}>
                <h4>All Available Badges</h4>
                <div className="badges-compact-grid">
                    {allBadges.map((badge, i) => {
                        const isUnlocked = badge.type === "active" ? activeDays >= badge.req : practiceQuestions >= badge.req;
                        const progress = badge.type === "active"
                            ? Math.min((activeDays / badge.req) * 100, 100)
                            : Math.min((practiceQuestions / badge.req) * 100, 100);

                        return (
                            <div key={i} className={`compact-badge ${isUnlocked ? 'unlocked' : 'locked'}`}>
                                <badge.icon size={32} color={isUnlocked ? "#10b981" : "#666"} />
                                <div>
                                    <strong>{badge.name}</strong><br />
                                    <small>{badge.desc}</small>
                                    <div className="mini-progress">
                                        <div style={{ width: `${progress}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </motion.div>

            <style jsx>{`
  /* ─────── UNLOCKED BADGES SHOWCASE ─────── */
  .unlocked-badges-showcase h3 {
    text-align: center;
    color: #1279e1ff;
    font-size: 1.9rem;
    margin: 2.5rem 0 1.8rem;
    font-weight: 600;
  }

  .unlocked-badges-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 1.8rem;
    margin: 2rem 0;
    justify-items: center;
    padding: 0 1rem;
  }

  .unlocked-badge {
    background: linear-gradient(135deg, #064e3b, #065f46);
    border: 2.5px solid #10b981;
    border-radius: 20px;
    padding: 1.6rem 1rem;
    text-align: center;
    transition: all 0.4s ease;
    box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
  }

  .unlocked-badge:hover {
    transform: translateY(-12px) scale(1.1);
    box-shadow: 0 20px 40px rgba(16, 185, 129, 0.5);
    border-color: #34d399;
  }

  .unlocked-badge p {
    margin: 0.8rem 0 0;
    font-weight: 700;
    color: #ecfdf5;
    font-size: 1.15rem;
    text-shadow: 0 1px 4px rgba(0,0,0,0.6);
  }
    .stat-card {
  text-align: center;
  padding: 1.5rem;
}

.stat-card h3 {
  margin: 0.5rem 0 0.3rem;
  font-size: 2.2rem;
  font-weight: 700;
}

.stat-card p {
  margin: 0;
  color: #94a3b8;
  font-size: 1rem;
  font-weight: 500;
}


  /* ─────── ALL BADGES (COMPACT VIEW) ─────── */
  .all-badges-compact h4 {
    text-align: center;
    color: #1e4e22ff;
    font-size: 1.6rem;
    margin: 3rem 0 1.8rem;
    font-weight: 500;
  }

  .badges-compact-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1.3rem;
    padding: 0 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .compact-badge {
    display: flex;
    align-items: center;
    gap: 1.3rem;
    padding: 1.3rem 1.6rem;
    border-radius: 18px;
    transition: all 0.35s ease;
    font-family: inherit;
  }

  /* UNLOCKED - GREEN BOX */
  .compact-badge.unlocked {
    background: linear-gradient(135deg, #064e3b, #065f46);
    border: 2px solid #10b981;
    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
  }

  .compact-badge.unlocked:hover {
    transform: translateY(-6px) scale(1.02);
    box-shadow: 0 15px 35px rgba(16, 185, 129, 0.4);
    border-color: #34d399;
  }

  .compact-badge.unlocked strong {
    color: #ecfdf5 !important;
    font-size: 1.2rem;
    font-weight: 700;
  }

  .compact-badge.unlocked small {
    color: #a7f3d0 !important;
    font-size: 0.98rem;
  }

  /* LOCKED - GREY BOX (SAME SHAPE) */
  .compact-badge.locked {
    background: linear-gradient(135deg, #1a1a1a, #2d2d2d);
    border: 2px solid #525252;
    opacity: 0.9;
  }

  .compact-badge.locked:hover {
    transform: translateY(-4px);
    border-color: #737373;
    box-shadow: 0 10px 20px rgba(0,0,0,0.3);
  }

  .compact-badge.locked strong {
    color: #e2e8f0 !important;
    font-size: 1.2rem;
    font-weight: 700;
  }

  .compact-badge.locked small {
    color: #94a3b8 !important;
    font-size: 0.98rem;
  }

  /* PROGRESS BAR */
  .mini-progress {
    height: 9px;
    background: #334155;
    border-radius: 6px;
    margin-top: 0.8rem;
    overflow: hidden;
    width: 100%;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.4);
  }

  .mini-progress > div {
    height: 100%;
    border-radius: 6px;
    transition: width 1s ease;
  }

  .compact-badge.unlocked .mini-progress > div {
    background: linear-gradient(90deg, #10b981, #34d399);
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.6);
  }

  .compact-badge.locked .mini-progress > div {
    background: #64748b;
  }

  /* RESPONSIVE */
  @media (max-width: 768px) {
    .badges-compact-grid {
      grid-template-columns: 1fr;
      gap: 1.1rem;
    }
    .unlocked-badges-grid {
      gap: 1.4rem;
    }
  }
`}</style>
        </motion.section>
    );
};

export default Gamification;