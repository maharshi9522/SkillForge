// File: src/components/Navbar.js

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FaBars, FaTimes, FaSignOutAlt } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = ({ isMenuOpen, toggleMenu, isAuthenticated, user, onLogout }) => {
  const navigate = useNavigate();

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/mock-interviews', label: 'Mock Interviews' },
    { path: '/soft-skills', label: 'Soft Skills' },
    { path: '/aptitude-tests', label: 'Aptitude Tests' },
    { path: '/gamification', label: 'Gamification' },
    { path: '/profile', label: 'Profile' },
  ];

  const sidebarVariants = {
    hidden: { x: '100%' },
    visible: { x: 0, transition: { duration: 0.2, ease: 'easeOut' } },
    exit: { x: '100%', transition: { duration: 0.2, ease: 'easeIn' } },
  };

  const logoVariants = {
    initial: { scale: 1, opacity: 0.8 },
    animate: { scale: 1, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
    hover: { scale: 1.05, textShadow: '0 0 8px rgba(100, 150, 255, 0.7)', transition: { duration: 0.1 } },
  };

  const handleLogoClick = () => {
    navigate('/');
  };

  const handleLogout = (e) => {
    e.preventDefault();
    if (onLogout) onLogout();
    toggleMenu();
  };

  const hoverBgStyle = {
    backgroundColor: 'rgba(0, 128, 128, 0.1)',
    borderRadius: '4px',
  };

  return (
    <>
      <motion.header
        className="navbar"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <nav>
          <motion.div
            className="nav-logo"
            variants={logoVariants}
            initial="initial"
            animate="animate"
            whileHover="hover"
            onClick={handleLogoClick}
            style={{ cursor: 'pointer' }}
          >
            <span>SkillForge</span>
          </motion.div>
          <motion.button
            className="hamburger"
            onClick={toggleMenu}
            whileHover={{ scale: 1.1, rotate: 90 }}
            transition={{ duration: 0.1 }}
          >
            {isMenuOpen ? <FaTimes /> : <FaBars />}
          </motion.button>
        </nav>
      </motion.header>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            className="sidebar"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={sidebarVariants}
          >
            <motion.button
              className="close-btn"
              onClick={toggleMenu}
              whileHover={{ scale: 1.1, rotate: 90 }}
              transition={{ duration: 0.1 }}
            >
              <FaTimes />
            </motion.button>
            <ul>
              {navLinks.map((link, index) => (
                <motion.li
                  key={link.path}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  <NavLink
                    to={link.path}
                    onClick={toggleMenu}
                    className={({ isActive }) => (isActive ? 'active' : '')}
                  >
                    {link.label}
                  </NavLink>
                </motion.li>
              ))}
              {isAuthenticated && (
                <motion.li
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: navLinks.length * 0.05 }}
                >
                  <NavLink
                    to="#"
                    onClick={handleLogout}
                    className={({ isActive }) => (isActive ? 'active' : '')}
                    style={{
                      fontSize: '0.9em',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'white',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={(e) => {
                      Object.assign(e.target.style, hoverBgStyle);
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '';
                    }}
                  >
                    <FaSignOutAlt style={{ 
                      marginRight: '6px', 
                      fontSize: '0.9em',
                      width: '16px',
                      height: '16px'
                    }} /> 
                    Logout ({user ? user.split('@')[0] : 'User'})
                  </NavLink>
                </motion.li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;