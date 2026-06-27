
import React, { useState, useEffect } from "react";
import {
  FaBullseye,
  FaUsers,
  FaCode,
  FaLightbulb,
  FaMicrophone,
  FaBrain,
  FaTrophy,
  FaGlobe,
  FaChartLine,
  FaEnvelope,
  FaComment,
  FaPlayCircle,
  FaRocket,
  FaBook,
  FaUserGraduate,
  FaTimes,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import Prism from "./Prism";
import api from "../utils/axios"; // For API calls

export default function Home({ isAuthenticated, user }) {
  const [showWelcome, setShowWelcome] = useState(false);

  // Contact form states
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState('');

  // Feedback form states
  const [feedbackName, setFeedbackName] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  useEffect(() => {
    if (sessionStorage.getItem('justLoggedIn') === 'true') {
      sessionStorage.removeItem('justLoggedIn');
      setShowWelcome(true);
      const timer = setTimeout(() => setShowWelcome(false), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleGetStarted = () => {
    console.log('Get Started clicked. Authenticated:', isAuthenticated);  // Debug log
    if (isAuthenticated) {
      console.log('Scrolling to How to Get Started section');  // Debug
      const section = document.getElementById('how-to-get-started');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
      } else {
        // Fallback: Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      console.log('Redirecting to /login');  // Debug
      window.location.href = '/login';
    }
  };

  // Handle contact form submit
  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactMessage) return;

    setContactSubmitting(true);
    setContactSuccess(false);
    setContactError('');

    try {
      await api.post('/api/contact', { name: contactName, email: contactEmail, message: contactMessage });
      setContactSuccess(true);
      // Reset form
      setContactName('');
      setContactEmail('');
      setContactMessage('');
    } catch (err) {
      setContactError(err.response?.data?.error || 'Failed to send message. Please try again.');
    }
    setContactSubmitting(false);
  };

  // Handle feedback form submit
  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackName || !feedbackText) return;

    setFeedbackSubmitting(true);
    setFeedbackSuccess(false);
    setFeedbackError('');

    try {
      await api.post('/api/feedback', { name: feedbackName, feedback: feedbackText });
      setFeedbackSuccess(true);
      // Reset form
      setFeedbackName('');
      setFeedbackText('');
    } catch (err) {
      setFeedbackError(err.response?.data?.error || 'Failed to submit feedback. Please try again.');
    }
    setFeedbackSubmitting(false);
  };

  const balloonVariants = {
    initial: { y: "100vh", scale: 0, opacity: 0 },
    animate: (i) => ({
      y: "-50vh",
      scale: 1,
      opacity: 1,
      transition: {
        duration: 3 + i * 0.2,
        ease: "easeOut",
        delay: i * 0.1,
      },
    }),
    exit: { y: "-100vh", scale: 1.2, opacity: 0, transition: { duration: 1 } },
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.5, ease: "easeOut" },
    },
    exit: { opacity: 0, scale: 0.8, transition: { duration: 0.3 } },
  };

  const fadeInVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  const logoVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: "easeOut" } },
    hover: { scale: 1.05, textShadow: "0 0 12px rgba(100, 150, 255, 0.7)", transition: { duration: 0.1 } },
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: (i) => ({
      opacity: 1,
      scale: 1,
      transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" },
    }),
    hover: { scale: 1.05, boxShadow: "0 8px 20px rgba(100, 150, 255, 0.5)", transition: { duration: 0.1 } },
  };

  const stepVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.15, duration: 0.4, ease: "easeOut" },
    }),
    hover: { scale: 1.05, boxShadow: "0 8px 20px rgba(100, 150, 255, 0.5)", transition: { duration: 0.1 } },
  };

  const username = user ? user.split('@')[0] : sessionStorage.getItem('user')?.split('@')[0] || 'User';

  return (
    <div className="home-container">
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            className="welcome-modal-overlay"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setShowWelcome(false)}
          >
            <motion.div
              className="welcome-modal"
              variants={modalVariants}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div className="welcome-content">
                <FaTimes className="close-icon" onClick={() => setShowWelcome(false)} />
                <h2>Welcome, {username}! 🎉</h2>
                <p>Your placement journey begins now!</p>
              </motion.div>
              {Array.from({ length: 10 }, (_, i) => (
                <motion.div
                  key={i}
                  className="balloon"
                  custom={i}
                  variants={balloonVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  style={{
                    left: `${Math.random() * 100}%`,
                    backgroundColor: `hsl(${Math.random() * 360}, 70%, 60%)`,
                  }}
                >
                  🎈
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.section
        className="hero"
        initial="hidden"
        animate="visible"
        variants={fadeInVariants}
      >
        <div className="prism-background">
          <Prism
            animationType="2drotate"
            timeScale={0.2}
            height={3.5}
            baseWidth={5.5}
            scale={4.0}
            hueShift={0.5}
            colorFrequency={0.4}
            noise={0.1}
            glow={3.5}
            bloom={3.5}
            transparent={true}
            suspendWhenOffscreen={true}
          />
        </div>
        <motion.h1
          variants={logoVariants}
          initial="hidden"
          animate="visible"
          whileHover="hover"
        >
          SkillForge 🔥
        </motion.h1>
        <p className="hero-text">Your AI-powered path to placement success!</p>
        <motion.button
          className="cta-btn"
          variants={cardVariants}
          whileHover="hover"
          onClick={handleGetStarted}
        >
          Get Started Free
        </motion.button>
      </motion.section>

      <motion.section
        className="section about"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeInVariants}
      >
        <h2>About SkillForge 🌟</h2>
        <div className="card-grid">
          {[
            {
              icon: <FaRocket className="icon" />,
              title: "Empowering Students",
              desc: "SkillForge is an AI-driven platform designed to boost placement readiness for Indian students through voice-based training.",
            },
            {
              icon: <FaBook className="icon" />,
              title: "Proper Learning",
              desc: "Supports English, making it accessible to Main language across India.",
            },
            {
              icon: <FaUserGraduate className="icon" />,
              title: "Holistic Preparation",
              desc: "Combines mock interviews, aptitude tests, and soft skills training to prepare students for real-world challenges.",
            },
          ].map((item, index) => (
            <motion.div
              key={index}
              custom={index}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              whileHover="hover"
              viewport={{ once: true }}
              className="card"
            >
              {item.icon}
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="section objectives"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeInVariants}
      >
        <h2>Our Objectives 🎯</h2>
        <div className="card-grid">
          {[
            {
              icon: <FaBullseye className="icon" />,
              title: "AI-Powered Training",
              desc: "Voice-based training tailored for Indian placements with real-time feedback.",
            },
            {
              icon: <FaUsers className="icon" />,
              title: "Inclusivity & Diversity",
              desc: "support in English for students.",
            },
            {
              icon: <FaCode className="icon" />,
              title: "Engagement & Collaboration",
              desc: "Gamified learning and batch collaboration for sustained participation.",
            },
            {
              icon: <FaLightbulb className="icon" />,
              title: "Real-World Readiness",
              desc: "Mock interviews and aptitude tests to boost employability.",
            },
          ].map((item, index) => (
            <motion.div
              key={index}
              custom={index}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              whileHover="hover"
              viewport={{ once: true }}
              className="card"
            >
              {item.icon}
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="section features"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeInVariants}
      >
        <h2>Why Choose SkillForge? 🚀</h2>
        <div className="card-grid">
          {[
            {
              icon: <FaMicrophone className="icon" />,
              title: "Voice-Based Mock Interviews",
              desc: "Practice HR and technical interviews with AI-driven feedback.",
            },
            {
              icon: <FaBrain className="icon" />,
              title: "Adaptive Aptitude Tests",
              desc: "Master quantitative, logical, and verbal skills with dynamic tests.",
            },
            {
              icon: <FaTrophy className="icon" />,
              title: "Gamified Learning",
              desc: "Earn coins and badges through engaging challenges.",
            },
            {
              icon: <FaGlobe className="icon" />,
              title: "Language Support",
              desc: "Interact in English for inclusive learning.",
            },
            {
              icon: <FaChartLine className="icon" />,
              title: "Batch Collaboration",
              desc: "Learn with peers through group discussions and shared goals.",
            },
          ].map((item, index) => (
            <motion.div
              key={index}
              custom={index}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              whileHover="hover"
              viewport={{ once: true }}
              className="card"
            >
              {item.icon}
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Added id="how-to-get-started" for scroll target */}
      <motion.section
        id="how-to-get-started"  // New: Scroll target
        className="section flowchart"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeInVariants}
      >
        <h2>How to Get Started 🚀</h2>
        <div className="flowchart-steps">
          {[
            {
              icon: <FaPlayCircle className="step-icon" />,
              title: "1. Sign Up",
              desc: "Create an account to access your personalized dashboard.",
            },
            {
              icon: <FaPlayCircle className="step-icon" />,
              title: "2. Choose a Module",
              desc: "Explore mock interviews, aptitude tests, or soft skills training.",
            },
            {
              icon: <FaPlayCircle className="step-icon" />,
              title: "3. Practice",
              desc: "Use voice input to practice and get instant AI feedback.",
            },
            {
              icon: <FaPlayCircle className="step-icon" />,
              title: "4. Collaborate",
              desc: "Join batch groups to learn and compete with peers.",
            },
            {
              icon: <FaPlayCircle className="step-icon" />,
              title: "5. Succeed",
              desc: "Track progress and apply skills in real placements.",
            },
          ].map((item, index) => (
            <React.Fragment key={index}>
              <motion.div
                custom={index}
                variants={stepVariants}
                initial="hidden"
                whileInView="visible"
                whileHover="hover"
                viewport={{ once: true }}
                className="step"
              >
                {item.icon}
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </motion.div>
              {index < 4 && (
                <motion.span
                  className="arrow"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.2 }}
                >
                  →
                </motion.span>
              )}
            </React.Fragment>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="section contact-feedback"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeInVariants}
      >
        <h2>Contact & Feedback 📬</h2>
        <div className="card-grid">
          {/* Contact Form Card */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            whileHover="hover"
            viewport={{ once: true }}
            className="card"
          >
            <FaEnvelope className="icon" />
            <h3>Contact Us</h3>
            <form className="contact-form" onSubmit={handleContactSubmit}>
              <input 
                type="text" 
                placeholder="Your Name" 
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required 
              />
              <input 
                type="email" 
                placeholder="Your Email" 
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required 
              />
              <textarea 
                placeholder="Your Message" 
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                rows={4}
                required 
              />
              <motion.button
                type="submit"
                className="form-btn"
                variants={cardVariants}
                whileHover="hover"
                disabled={contactSubmitting}
              >
                {contactSubmitting ? 'Sending...' : 'Send Message'}
              </motion.button>
            </form>
            <AnimatePresence>
              {contactSuccess && (
                <motion.p
                  className="success-message"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{ color: '#10b981', fontSize: '14px', marginTop: '10px' }}
                >
                  Message sent successfully! We'll get back to you soon. 🎉
                </motion.p>
              )}
              {contactError && (
                <motion.p
                  className="error-message"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{ color: '#ef4444', fontSize: '14px', marginTop: '10px' }}
                >
                  {contactError}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Feedback Form Card */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            whileHover="hover"
            viewport={{ once: true }}
            className="card"
          >
            <FaComment className="icon" />
            <h3>Feedback</h3>
            <form className="feedback-form" onSubmit={handleFeedbackSubmit}>
              <input 
                type="text" 
                placeholder="Your Name" 
                value={feedbackName}
                onChange={(e) => setFeedbackName(e.target.value)}
                required 
              />
              <textarea 
                placeholder="Your Feedback" 
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={4}
                required 
              />
              <motion.button
                type="submit"
                className="form-btn"
                variants={cardVariants}
                whileHover="hover"
                disabled={feedbackSubmitting}
              >
                {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </motion.button>
            </form>
            <AnimatePresence>
              {feedbackSuccess && (
                <motion.p
                  className="success-message"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{ color: '#10b981', fontSize: '14px', marginTop: '10px' }}
                >
                  Feedback submitted! Thank you for your input. 😊
                </motion.p>
              )}
              {feedbackError && (
                <motion.p
                  className="error-message"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{ color: '#ef4444', fontSize: '14px', marginTop: '10px' }}
                >
                  {feedbackError}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </motion.section>
  
      <footer className="footer">
        <p>© 2025 SkillForge | All Rights Reserved | Developed by CSAI-B Group SY-B-02</p>
      </footer>
    </div>
  );
}