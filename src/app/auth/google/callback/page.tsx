'use client';

import { useEffect, useState } from 'react';

async function completeGoogleFromToken(accessToken: string, sid: string) {
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const profile = await profileRes.json();
  if (!profile.email) {
    throw new Error('Google profile email was missing.');
  }

  const googleRes = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: String(profile.email).toLowerCase(),
      name: profile.name || 'Google User',
      googleId: profile.sub,
      picture: profile.picture,
      refCode: typeof window !== 'undefined' ? localStorage.getItem('star_ref_code') || '' : ''
    })
  });
  const googleData = await googleRes.json();
  if (!googleRes.ok || !googleData.success) {
    throw new Error(googleData.message || 'Google sign-in failed.');
  }

  if (typeof window !== 'undefined' && googleData.token) {
    localStorage.setItem('star_token', googleData.token);
    localStorage.setItem('star_user', JSON.stringify(googleData.user));
  }

  if (sid) {
    const completeRes = await fetch('/api/auth/google/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'complete',
        sid,
        token: googleData.token,
        user: googleData.user,
        isNewUser: googleData.isNewUser
      })
    });
    const completeData = await completeRes.json();
    if (!completeRes.ok || !completeData.success) {
      throw new Error(completeData.message || 'Could not finish Google sign-in.');
    }
    return { mode: 'session', sid };
  }

  const ticketRes = await fetch('/api/auth/google/ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: googleData.user, token: googleData.token, isNewUser: googleData.isNewUser })
  });
  const ticketData = await ticketRes.json();
  return { mode: 'ticket', ticket: ticketData.ticket };
}

export default function GoogleOAuthCallbackPage() {
  const [status, setStatus] = useState('Signing you in with Google…');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);
        const queryParams = new URLSearchParams(window.location.search);
        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const sid = hashParams.get('state') || queryParams.get('state') || '';
        const err = hashParams.get('error') || queryParams.get('error');
        if (err) throw new Error('Google sign-in was cancelled.');
        if (!accessToken) throw new Error('Missing Google access token.');

        const result = await completeGoogleFromToken(accessToken, sid);
        if (cancelled) return;

        if (result.mode === 'session') {
          setStatus('Signed in! Return to 7 STAR INVEST app — login will finish automatically.');
          setTimeout(() => {
            window.location.replace('/dashboard.html');
          }, 1500);
          return;
        }

        setStatus('Signed in. Opening 7 STAR INVEST…');
        window.location.replace('/dashboard.html');
      } catch (err: any) {
        if (cancelled) return;
        setError(err.message || 'Google sign-in failed.');
        setStatus('Could not complete Google sign-in.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
        background: '#0d1117',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center'
      }}
    >
      <div style={{ maxWidth: 420, background: '#161b22', padding: '2.5rem 1.75rem', borderRadius: '24px', border: '1px solid #30363d' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⭐</div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b', marginBottom: '0.75rem' }}>7 STAR INVEST</h1>
        <p style={{ color: error ? '#f87171' : '#34d399', fontWeight: 600, fontSize: '0.95rem', marginBottom: '1.25rem' }}>
          {error || status}
        </p>
        {!error && (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            You can close this tab and go back to the app.
          </p>
        )}
        {error && (
          <a href="/login.html" style={{ color: '#0d9488', fontWeight: 700, textDecoration: 'none' }}>
            Back to login
          </a>
        )}
      </div>
    </main>
  );
}
