'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [notice, setNotice] = useState('🌟 Welcome to 7 STAR INVEST - Halal & Trusted Earning Platform 💯 | Daily Returns Credited Automatically!');
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.notice_text) setNotice(data.settings.notice_text);
        if (data.plans) setPlans(data.plans);
      })
      .catch((err) => console.error('Config fetch error:', err));
  }, []);

  return (
    <>
      {/* Live Notice Ticker */}
      <div className="notice-marquee">
        <span className="marquee-badge">ANNOUNCEMENT</span>
        {/* @ts-ignore */}
        <marquee>{notice}</marquee>
      </div>

      {/* Header Navbar */}
      <header className="navbar">
        <div className="container nav-container">
          <Link href="/" className="brand-logo">
            <img src="/images/logo.png" alt="7 Star Logo" />
            <span>7 STAR INVEST</span>
          </Link>
          <nav className="nav-links">
            <Link href="/login" className="btn btn-outline btn-sm">Login</Link>
            <Link href="/register" className="btn btn-gold btn-sm">Register</Link>
          </nav>
        </div>
      </header>

      {/* Hero Banner Section */}
      <section className="hero-section container">
        <div className="hero-content">
          <div className="trust-badges">
            <span className="badge-item">⭐ محفوظ اور قابلِ اعتماد نظام</span>
            <span className="badge-item">⭐ بہترین معیار اور شفاف طریقۂ کار</span>
            <span className="badge-item">🌟 حلال ارننگ الحمدللہ 💯</span>
          </div>
          <h1 className="hero-title">High-Yield Financial Growth with 7 Star Invest</h1>
          <p className="hero-subtitle">Start earning guaranteed daily returns with VIP Investment plans. Seamless Easypaisa & JazzCash deposits with instant automated withdrawals.</p>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link href="/register" className="btn btn-gold">Get Started Now</Link>
            <a href="/download-apk" className="btn btn-cyan">
              📲 Download Mobile App (APK)
            </a>
          </div>
        </div>
        <div className="hero-img-box">
          <img src="/images/hero_banner.png" alt="7 Star Investment Dashboard Banner" />
        </div>
      </section>

      {/* VIP Investment Plans Section */}
      <section id="plans" className="container" style={{ padding: '3rem 0' }}>
        <h2 className="section-title">VIP Investment Plans</h2>
        <p className="section-subtitle">Choose a VIP package and start earning daily profit directly to your wallet</p>
        
        <div className="plans-grid">
          {plans.map((p) => (
            <div key={p.id || p._id} className="plan-card">
              <span className="plan-badge">{p.name}</span>
              <div className="plan-price">PKR {p.price?.toLocaleString()} <span>/ {p.validity_days || p.validityDays} Days</span></div>
              <ul className="plan-stats">
                <li><span>Daily Return</span> <strong>PKR {p.daily_profit || p.dailyProfit}</strong></li>
                <li><span>Total Return</span> <strong>PKR {p.total_profit || p.totalProfit}</strong></li>
                <li><span>Level 1 Commission</span> <strong>PKR {p.level1_bonus || p.level1Bonus}</strong></li>
                <li><span>Level 2 Commission</span> <strong>PKR {p.level2_bonus || p.level2Bonus}</strong></li>
              </ul>
              <Link href="/register" className="btn btn-gold btn-full">
                👑 Activate {p.name}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Referral & Commission Section */}
      <section className="container" style={{ padding: '2rem 0' }}>
        <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'center' }}>
          <div>
            <h2 style={{ color: 'var(--primary-gold)', marginBottom: '1rem' }}>2-Tier Team Commission System</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Earn residual passive income by inviting your friends and team members to 7 Star Invest.</p>
            <ul style={{ listStyle: 'none', marginBottom: '1.5rem' }}>
              <li style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ background: 'var(--primary-gold)', color: '#ffffff', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px' }}>Level 1</span>
                <strong>5% Direct Commission</strong> on all team investments
              </li>
              <li style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ background: 'var(--cyan-neon)', color: '#ffffff', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px' }}>Level 2</span>
                <strong>2% Indirect Commission</strong> on downline team investments
              </li>
            </ul>
            <Link href="/register" className="btn btn-cyan">Join Team & Get Link</Link>
          </div>
          <div>
            <img src="/images/referral_banner.png" alt="Referral Bonus" style={{ width: '100%', borderRadius: '16px', border: '1px solid #e2e8f0' }} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '2rem 0', marginTop: '4rem', textAlign: 'center' }}>
        <div className="container">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>© 2026 7 STAR INVEST. All Rights Reserved. Halal & Secure Earnings System.</p>
        </div>
      </footer>

      {/* Floating WhatsApp Contact Button */}
      <a href="https://wa.me/923000000000" target="_blank" rel="noopener noreferrer" className="whatsapp-float" title="Contact Support on WhatsApp">
        💬
      </a>
    </>
  );
}
