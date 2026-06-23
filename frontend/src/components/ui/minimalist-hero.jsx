import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const NavLink = ({ href, children }) => (
  <a
    href={href}
    className="text-sm font-medium tracking-widest text-foreground/60 transition-colors hover:text-foreground"
    style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '14px',
      letterSpacing: '0.1em', fontWeight: 500, transition: 'color 0.15s' }}
    onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
  >
    {children}
  </a>
);

const SocialIcon = ({ href, icon: Icon }) => (
  <a href={href} target="_blank" rel="noopener noreferrer"
    style={{ color: 'rgba(255,255,255,0.5)', transition: 'color 0.15s', display: 'flex' }}
    onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
  >
    <Icon size={18} />
  </a>
);

export const MinimalistHero = ({
  logoText,
  navLinks,
  mainText,
  ctaLabel,
  ctaHref,
  imageSrc,
  imageAlt,
  overlayText,
  socialLinks,
  locationText,
  className,
}) => {
  return (
    <div
      className={cn('relative flex flex-col items-center justify-between overflow-hidden', className)}
      style={{
        minHeight: '100svh', width: '100%',
        background: '#0a0a0f',
        padding: '32px 48px',
        fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif",
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(0,102,204,0.18) 0%, transparent 70%)',
      }} />

      {/* Header */}
      <header style={{ zIndex: 10, width: '100%', maxWidth: '1100px', margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          style={{ fontSize: '20px', fontWeight: 700, color: '#fff',
            letterSpacing: '0.05em', fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif" }}
        >
          {logoText}
        </motion.div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          {navLinks.map(link => (
            <NavLink key={link.label} href={link.href}>{link.label}</NavLink>
          ))}
        </div>
        <motion.a
          href={ctaHref}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            padding: '10px 22px', borderRadius: '9999px',
            background: 'var(--blue)', color: '#fff', border: 'none',
            fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
            textDecoration: 'none', display: 'inline-block',
            transition: 'background 0.15s',
          }}
          onHoverStart={e => {}}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
        >
          {ctaLabel}
        </motion.a>
      </header>

      {/* Main content */}
      <div style={{
        position: 'relative', zIndex: 10, width: '100%', maxWidth: '1100px',
        margin: '0 auto', flex: 1, display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', gap: '32px',
        paddingTop: '40px',
      }}>
        {/* Left text */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          style={{ textAlign: 'left' }}
        >
          <p style={{ fontSize: '16px', lineHeight: 1.7, color: 'rgba(255,255,255,0.65)', maxWidth: '220px' }}>
            {mainText}
          </p>
          <a href={ctaHref} style={{
            marginTop: '20px', display: 'inline-block', fontSize: 'var(--text-sm)', fontWeight: 600,
            color: 'var(--blue)', textDecoration: 'underline', textUnderlineOffset: '3px',
          }}>
            {ctaLabel} →
          </a>
        </motion.div>

        {/* Center: circle + image */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: '420px' }}>
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            style={{
              position: 'absolute', bottom: '0',
              width: '340px', height: '340px', borderRadius: '50%',
              background: 'radial-gradient(circle, #4FA3CE 0%, #003d7a 100%)',
              opacity: 0.85,
            }}
          />
          <motion.img
            src={imageSrc}
            alt={imageAlt}
            style={{
              position: 'relative', zIndex: 2,
              height: '400px', width: 'auto', objectFit: 'cover',
              objectPosition: 'top',
              filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.6))',
            }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
            onError={e => {
              e.target.onerror = null;
              e.target.src = 'https://images.unsplash.com/photo-1576765974256-9b879d60a571?auto=format&fit=crop&w=400&h=600&q=80';
            }}
          />
        </div>

        {/* Right: large overlay text */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.0 }}
          style={{ textAlign: 'left' }}
        >
          <h1 style={{
            fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif",
            fontSize: 'clamp(60px, 6vw, 96px)', fontWeight: 800,
            color: '#ffffff', lineHeight: 1.0, margin: 0,
            letterSpacing: '-0.04em',
          }}>
            {overlayText.part1}
            <br />
            <span style={{ color: 'var(--blue)' }}>{overlayText.part2}</span>
          </h1>
        </motion.div>
      </div>

      {/* Footer */}
      <footer style={{ zIndex: 10, width: '100%', maxWidth: '1100px', margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.2 }}
          style={{ display: 'flex', alignItems: 'center', gap: '20px' }}
        >
          {socialLinks.map((link, i) => (
            <SocialIcon key={i} href={link.href} icon={link.icon} />
          ))}
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.3 }}
          style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}
        >
          {locationText}
        </motion.div>
      </footer>
    </div>
  );
};
