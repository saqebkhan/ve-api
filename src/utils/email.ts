import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Email sender
const getEmailFrom = () => {
  return SMTP_USER || "noreply@ve-admin.com";
};

// ─── Transporter setup ──────────────────────────────────────────────────
let smtpTransporter: nodemailer.Transporter | null = null;

const getEmailTransport = () => {
  if (!smtpTransporter && SMTP_HOST && SMTP_USER && SMTP_PASS) {
    const secure = SMTP_PORT === 465;

    smtpTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
    console.log("📬  Email transport initialized (Google SMTP)");
  }
  return smtpTransporter;
};

// ─── Helper function to send email ──────────────────────────────────────
const sendEmail = async (options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> => {
  const transporter = getEmailTransport();

  if (!transporter) {
    throw new Error(
      "Email service not configured. Please set SMTP credentials."
    );
  }

  try {
    await transporter.sendMail({
      from: getEmailFrom(),
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  } catch (error) {
    console.error(`❌  Failed to send email to ${options.to}:`, error);
    throw error;
  }
};

// ─── Send Verification Email ──────────────────────────────────────────────────
export const sendVerificationEmail = async (
  email: string,
  name: string,
  token: string
): Promise<void> => {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify your email — ve-admin</title>
    </head>
    <body style="margin:0;padding:0;background:#020617;font-family:'Inter',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#020617;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="580" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:24px;border:1px solid #1e293b;overflow:hidden;">
              <tr>
                <td style="padding:48px 48px 32px;border-bottom:1px solid #1e293b;">
                  <div style="display:flex;align-items:center;gap:12px;">
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#7c3aed,#8b5cf6);border-radius:12px;display:inline-block;vertical-align:middle;"></div>
                    <span style="font-size:20px;font-weight:900;color:#f8fafc;vertical-align:middle;margin-left:12px;letter-spacing:-0.5px;">ve-admin</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:48px;">
                  <h1 style="margin:0 0 16px;font-size:24px;font-weight:900;color:#f8fafc;letter-spacing:-0.5px;">Verify your email</h1>
                  <p style="margin:0 0 8px;color:#94a3b8;font-size:15px;line-height:1.6;">Hi <strong style="color:#e2e8f0;">${name}</strong>,</p>
                  <p style="margin:0 0 32px;color:#94a3b8;font-size:15px;line-height:1.6;">
                    Thanks for registering with ve-admin. Click the button below to verify your email address and activate your seller account.
                  </p>
                  <a href="${verifyUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c3aed,#8b5cf6);color:#fff;text-decoration:none;border-radius:999px;font-weight:900;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">
                    Verify Email Address
                  </a>
                  <p style="margin:32px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
                    This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.
                  </p>
                  <p style="margin:16px 0 0;color:#475569;font-size:12px;word-break:break-all;">
                    Or copy this link: <a href="${verifyUrl}" style="color:#8b5cf6;">${verifyUrl}</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 48px;border-top:1px solid #1e293b;background:#0a0f1e;">
                  <p style="margin:0;color:#475569;font-size:12px;">© 2024 ve-admin. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    await sendEmail({
      to: email,
      subject: "Verify your email — ve-admin",
      html,
    });
    console.log(`📧  Verification email sent to ${email}`);
  } catch (error) {
    console.error("❌  Failed to send verification email:", error);
    throw error;
  } finally {
    // Log the link for developer testing/debugging in all development settings
    if (process.env.NODE_ENV === "development") {
      console.log(`🔗  Verify URL (dev): ${verifyUrl}`);
    }
  }
};

// ─── Send Password Reset Email ────────────────────────────────────────────────
export const sendPasswordResetEmail = async (
  email: string,
  name: string,
  token: string
): Promise<void> => {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset your password — ve-admin</title>
    </head>
    <body style="margin:0;padding:0;background:#020617;font-family:'Inter',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#020617;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="580" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:24px;border:1px solid #1e293b;overflow:hidden;">
              <tr>
                <td style="padding:48px 48px 32px;border-bottom:1px solid #1e293b;">
                  <div>
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#7c3aed,#8b5cf6);border-radius:12px;display:inline-block;vertical-align:middle;"></div>
                    <span style="font-size:20px;font-weight:900;color:#f8fafc;vertical-align:middle;margin-left:12px;letter-spacing:-0.5px;">ve-admin</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:48px;">
                  <h1 style="margin:0 0 16px;font-size:24px;font-weight:900;color:#f8fafc;letter-spacing:-0.5px;">Reset your password</h1>
                  <p style="margin:0 0 8px;color:#94a3b8;font-size:15px;line-height:1.6;">Hi <strong style="color:#e2e8f0;">${name}</strong>,</p>
                  <p style="margin:0 0 32px;color:#94a3b8;font-size:15px;line-height:1.6;">
                    We received a request to reset the password for your ve-admin account. Click the button below to choose a new password.
                  </p>
                  <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c3aed,#8b5cf6);color:#fff;text-decoration:none;border-radius:999px;font-weight:900;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">
                    Reset Password
                  </a>
                  <p style="margin:32px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
                    This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password won't be changed.
                  </p>
                  <p style="margin:16px 0 0;color:#475569;font-size:12px;word-break:break-all;">
                    Or copy this link: <a href="${resetUrl}" style="color:#8b5cf6;">${resetUrl}</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 48px;border-top:1px solid #1e293b;background:#0a0f1e;">
                  <p style="margin:0;color:#475569;font-size:12px;">© 2024 ve-admin. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    await sendEmail({
      to: email,
      subject: "Reset your password — ve-admin",
      html,
    });
    console.log(`📧  Password reset email sent to ${email}`);
  } catch (error) {
    console.error("❌  Failed to send password reset email:", error);
    throw error;
  } finally {
    if (process.env.NODE_ENV === "development") {
      console.log(`🔗  Reset URL (dev): ${resetUrl}`);
    }
  }
};

// ─── Send Invitation Email ────────────────────────────────────────────────────
export const sendInvitationEmail = async (
  email: string,
  inviterName: string,
  shopName: string,
  token: string
): Promise<void> => {
  const onboardUrl = `${FRONTEND_URL}/onboard?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Join ${shopName} — ve-admin</title>
    </head>
    <body style="margin:0;padding:0;background:#020617;font-family:'Inter',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#020617;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="580" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:24px;border:1px solid #1e293b;overflow:hidden;">
              <tr>
                <td style="padding:48px 48px 32px;border-bottom:1px solid #1e293b;">
                  <div>
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#7c3aed,#8b5cf6);border-radius:12px;display:inline-block;vertical-align:middle;"></div>
                    <span style="font-size:20px;font-weight:900;color:#f8fafc;vertical-align:middle;margin-left:12px;letter-spacing:-0.5px;">ve-admin</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:48px;">
                  <h1 style="margin:0 0 16px;font-size:24px;font-weight:900;color:#f8fafc;letter-spacing:-0.5px;">Join the team</h1>
                  <p style="margin:0 0 8px;color:#94a3b8;font-size:15px;line-height:1.6;">Hi there,</p>
                  <p style="margin:0 0 32px;color:#94a3b8;font-size:15px;line-height:1.6;">
                    <strong style="color:#e2e8f0;">${inviterName}</strong> has invited you to join the team at <strong style="color:#e2e8f0;">${shopName}</strong> on ve-admin.
                  </p>
                  <a href="${onboardUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c3aed,#8b5cf6);color:#fff;text-decoration:none;border-radius:999px;font-weight:900;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">
                    Accept Invitation
                  </a>
                  <p style="margin:32px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
                    This invitation link expires in <strong>48 hours</strong>. If you weren't expecting this invitation, you can safely ignore this email.
                  </p>
                  <p style="margin:16px 0 0;color:#475569;font-size:12px;word-break:break-all;">
                    Or copy this link: <a href="${onboardUrl}" style="color:#8b5cf6;">${onboardUrl}</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 48px;border-top:1px solid #1e293b;background:#0a0f1e;">
                  <p style="margin:0;color:#475569;font-size:12px;">© 2024 ve-admin. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    await sendEmail({
      to: email,
      subject: `Invitation to join ${shopName} on ve-admin`,
      html,
    });
    console.log(`📧  Invitation email sent to ${email}`);
  } catch (error) {
    console.error("❌  Failed to send invitation email:", error);
    throw error;
  } finally {
    if (process.env.NODE_ENV === "development") {
      console.log(`🔗  Onboard URL (dev): ${onboardUrl}`);
    }
  }
};
