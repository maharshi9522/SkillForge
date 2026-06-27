import React from 'react';
import { motion } from 'framer-motion';

const Privacy = () => {
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
      <h2>Privacy Policy</h2>
      <p>Learn about how we handle your data and privacy.</p>
    </motion.section>
  );
};

export default Privacy;