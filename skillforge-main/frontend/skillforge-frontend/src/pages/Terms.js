import React from 'react';
import { motion } from 'framer-motion';

const Terms = () => {
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
      <h2>Terms of Service</h2>
      <p>Review the terms and conditions for using SkillForge.</p>
    </motion.section>
  );
};

export default Terms;