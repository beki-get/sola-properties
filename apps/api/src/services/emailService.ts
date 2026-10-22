import nodemailer from "nodemailer";

const host = process.env.MAILTRAP_HOST;
const port = Number(process.env.MAILTRAP_PORT);
const user = process.env.MAILTRAP_USER;
const password = process.env.MAILTRAP_PASSWORD;

if (!host || !Number.isInteger(port) || port <= 0 || !user || !password) {
  throw new Error("Mailtrap SMTP environment variables are missing or invalid");
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: {
    user,
    pass: password,
  },
});

export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<void> {
  const verificationUrl = `http://localhost:3000/verify-email?token=${encodeURIComponent(token)}`;

  await transporter.sendMail({
    from: '"Sola Properties" <hello@example.com>',
    to: email,
    subject: "Verify Your Sola Properties Email Address",
    text: `Welcome to Sola Properties!

Please verify your email address to complete your account registration.

Verify your email address: ${verificationUrl}

If you did not create a Sola Properties account, you can safely ignore this email.

Thank you,
The Sola Properties Team`,
    html: `
      <h2>Welcome to Sola Properties!</h2>

      <p>Thank you for creating an account with Sola Properties.</p>

      <p>Please verify your email address to complete your account registration.</p>

      <p>
        <a href="${verificationUrl}">Verify Email Address</a>
      </p>

      <p>If you did not create a Sola Properties account, you can safely ignore this email.</p>

      <p>Thank you,<br />
      <strong>Sola Properties</strong></p>
    `,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<void> {
  const resetUrl = `http://localhost:3000/reset-password?token=${encodeURIComponent(token)}`;

  await transporter.sendMail({
    from: '"Sola Properties" <sola@example.com>',
    to: email,
    subject: "Reset your Sola Properties password",
    text: `Reset your password by opening this link: ${resetUrl}`,
    html: `
      <h2>Password reset</h2>
      <p>Hello,</p>
      <p>We received a request to reset your password for your Sola Properties account.</p>
      <p>Click the link below to create a new password:</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>For your security, this password-reset link expires in 15 minutes. If the link expires, you can request a new one.</p>
      <p>If you did not request this, you can ignore this email.</p>
      <p>Thanks,</p>
      <p>Sola Properties</p>
    `,
  });
}
