import React from 'react';
import { motion } from 'framer-motion';

const Feedback = () => {
  const fadeInVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } },
  };

  return (
    <motion.section
      className="section"
      initial="hidden"
      animate="visible"
      variants={fadeInVariants}
    >
      <h2>Feedback</h2>
      <p>Share your thoughts and suggestions to help us improve SkillForge.</p>
    </motion.section>
  );
};

export default Feedback;