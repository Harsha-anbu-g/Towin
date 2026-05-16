import { Navigate } from 'react-router-dom';
import { Heart, Users, Shield, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MinimalistHero } from '../components/ui/minimalist-hero';

const navLinks = [
  { label: 'HOW IT WORKS', href: '#how' },
  { label: 'COMMUNITY',    href: '#community' },
  { label: 'TRUST',        href: '#trust' },
];

const socialLinks = [
  { icon: Heart,  href: '#' },
  { icon: Users,  href: '#' },
  { icon: Shield, href: '#' },
  { icon: Star,   href: '#' },
];

export default function Home() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <MinimalistHero
      logoText="ToWin"
      navLinks={navLinks}
      mainText="A trusted community where elders and helpers build real relationships — one small step at a time."
      ctaLabel="Get Started"
      ctaHref="/register"
      imageSrc="https://images.unsplash.com/photo-1576765974256-9b879d60a571?auto=format&fit=crop&w=500&h=700&q=85"
      imageAlt="Elder and helper smiling together"
      overlayText={{ part1: 'trust', part2: 'grows.' }}
      socialLinks={socialLinks}
      locationText="Building connections everywhere"
    />
  );
}
