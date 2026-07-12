import express from 'express';
import nodemailer from 'nodemailer';
import { query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

const canNotify = authorize('SAFETY_OFFICER', 'FLEET_MANAGER');

let cached = null;
async function getTransport() {
  if (cached) return cached;
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    cached = {
      transporter: nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, 
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      }),
      ethereal: false,
      from: `TransitOps Compliance <${process.env.EMAIL_USER}>`,
    };
  } else if (process.env.SMTP_HOST) {
    cached = {
      transporter: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      }),
      ethereal: false,
      from: `TransitOps Compliance <${process.env.SMTP_USER}>`,
    };
  } else {
    const acct = await nodemailer.createTestAccount();
    cached = {
      transporter: nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: { user: acct.user, pass: acct.pass },
      }),
      ethereal: true,
      from: 'TransitOps Compliance <alerts@transitops.com>',
    };
  }
  return cached;
}

function digestHtml(drivers, withinDays) {
  const rows = drivers
    .map((d) => {
      const expired = d.days_left < 0;
      const color = expired ? '#dc2626' : d.days_left <= 7 ? '#d97706' : '#ca8a04';
      const state = expired ? `Expired ${Math.abs(d.days_left)}d ago` : `Expires in ${d.days_left}d`;
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">${d.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-family:monospace;color:#555">${d.license_number}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#555">${d.license_expiry}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:${color};font-weight:600">${state}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#555">${d.contact_number || '—'}</td>
      </tr>`;
    })
    .join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:auto;color:#111">
    <div style="background:#0a0a0a;color:#fff;padding:20px 24px">
      <div style="font-size:12px;letter-spacing:2px;color:#888;text-transform:uppercase">TransitOps · Compliance</div>
      <div style="font-size:22px;font-weight:700;margin-top:4px">Driver Licence Alert</div>
    </div>
    <div style="padding:20px 24px">
      <p style="font-size:14px;line-height:1.6">The following <b>${drivers.length}</b> driver licence(s) are expired or expiring within <b>${withinDays} days</b> and must be reviewed before these drivers can be dispatched.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px">
        <thead><tr style="text-align:left;background:#f5f5f5">
          <th style="padding:8px 12px">Driver</th><th style="padding:8px 12px">Licence</th>
          <th style="padding:8px 12px">Expiry</th><th style="padding:8px 12px">Status</th><th style="padding:8px 12px">Contact</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:12px;color:#888;margin-top:20px">Automated reminder from TransitOps. Drivers with expired licences are automatically blocked from trip assignment.</p>
    </div>
  </div>`;
}

router.get('/license-reminders', canNotify, async (req, res) => {
  const withinDays = Number(req.query.withinDays) || 30;
  try {
    const { rows } = await query(
      `SELECT name, license_number, license_category,
              to_char(license_expiry, 'YYYY-MM-DD') AS license_expiry,
              (license_expiry - CURRENT_DATE)::int AS days_left, contact_number
       FROM drivers
       WHERE license_expiry <= CURRENT_DATE + ($1 * INTERVAL '1 day')
       ORDER BY license_expiry ASC`,
      [withinDays]
    );
    res.json({ withinDays, count: rows.length, drivers: rows });
  } catch (error) {
    console.error('License reminder preview error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/notifications/license-reminders — send the digest email
router.post('/license-reminders', canNotify, async (req, res) => {
  const withinDays = Number(req.body?.withinDays) || 30;
  // Default recipient: explicit override → NOTIFY_EMAIL → the configured mailbox → the logged-in user.
  const recipient = req.body?.to || process.env.NOTIFY_EMAIL || process.env.EMAIL_USER || req.user.email;
  try {
    const { rows } = await query(
      `SELECT name, license_number, license_category,
              to_char(license_expiry, 'YYYY-MM-DD') AS license_expiry,
              (license_expiry - CURRENT_DATE)::int AS days_left, contact_number
       FROM drivers
       WHERE license_expiry <= CURRENT_DATE + ($1 * INTERVAL '1 day')
       ORDER BY license_expiry ASC`,
      [withinDays]
    );

    if (!rows.length) {
      return res.json({ sent: false, count: 0, message: `No licences expiring within ${withinDays} days.` });
    }

    try {
      const { transporter, ethereal, from } = await getTransport();
      const info = await transporter.sendMail({
        from,
        to: recipient,
        subject: `⚠ ${rows.length} driver licence(s) need attention`,
        html: digestHtml(rows, withinDays),
      });
      res.json({
        sent: true,
        count: rows.length,
        recipient,
        preview: ethereal ? nodemailer.getTestMessageUrl(info) : null,
        drivers: rows,
      });
    } catch (mailErr) {
      // Degrade gracefully — still report who needs attention even if SMTP fails.
      console.error('Email send failed:', mailErr.message);
      res.json({ sent: false, count: rows.length, recipient, mailError: mailErr.message, drivers: rows });
    }
  } catch (error) {
    console.error('License reminder error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
