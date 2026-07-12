/**
 * Thin wrapper around the Resend HTTP API for transactional email.
 *
 * No SDK — Resend's HTTP API is two fields and an auth header, so a
 * bare fetch keeps the dependency surface tiny.
 *
 * Configuration (Render env vars):
 *   RESEND_API_KEY   secret key from resend.com/api-keys
 *   EMAIL_FROM       "Sender Name <addr@yourdomain.com>" — defaults
 *                    to "PathGuard <onboarding@resend.dev>" which
 *                    works without a verified domain BUT only to your
 *                    Resend-signup email until you verify a domain at
 *                    resend.com/domains.
 *   APP_URL          the public frontend URL used for verification
 *                    links — defaults to the Vercel deploy.
 */
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'PathGuard <onboarding@resend.dev>';
const DEFAULT_APP_URL = 'https://urban-mobility-ecru.vercel.app';

function isConfigured() {
  return !!process.env.RESEND_API_KEY;
}

async function send({ to, subject, html, text }) {
  if (!isConfigured()) {
    throw new Error('Email service not configured: RESEND_API_KEY missing');
  }
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || DEFAULT_FROM,
      to: [to],
      subject,
      html,
      text,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      `Resend error ${res.status}: ${data?.message || data?.name || 'unknown'}`
    );
    err.status = res.status;
    err.upstream = data;
    throw err;
  }
  return data;
}

function verificationEmail({ name, link }) {
  const safeName = (name || 'there').replace(/[<>]/g, '');
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:40px">🛡️</div>
        <h1 style="margin:8px 0 4px;font-size:22px">Welcome to PathGuard</h1>
        <p style="margin:0;color:#6b7280;font-size:14px">Urban Mobility Safety Platform · IIT KGP</p>
      </div>
      <p>Hi ${safeName},</p>
      <p>Thanks for signing up. Please confirm your email address so we know you're you.</p>
      <p style="text-align:center;margin:28px 0">
        <a href="${link}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">
          Verify my email
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px">Or paste this link into your browser:</p>
      <p style="word-break:break-all;font-size:12px;color:#374151">${link}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
      <p style="color:#9ca3af;font-size:12px">
        This link expires in 24 hours. If you didn't create a PathGuard account, you can ignore this email.
      </p>
    </div>`;
  const text = `Welcome to PathGuard.

Confirm your email by visiting:
${link}

This link expires in 24 hours. If you didn't create a PathGuard account you can ignore this email.`;
  return { html, text };
}

async function sendVerificationEmail({ to, name, token }) {
  const base = process.env.APP_URL || DEFAULT_APP_URL;
  const link = `${base.replace(/\/$/, '')}/?verify=${encodeURIComponent(token)}`;
  const { html, text } = verificationEmail({ name, link });
  return send({
    to,
    subject: 'Confirm your PathGuard email address',
    html,
    text,
  });
}

module.exports = {
  isConfigured,
  send,
  sendVerificationEmail,
};
