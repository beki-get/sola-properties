
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
  const verificationUrl =
    `http://localhost:3000/verify-email?token=${encodeURIComponent(token)}`;

  await transporter.sendMail({
    from: '"Sola Properties" <hello@example.com>',
    to: email,
    subject: "Verify your Sola Properties email",
    text: `Verify your email by opening this link: ${verificationUrl}`,
    html: `
      <h2>Verify your email</h2>
      <p>Click the link below to verify your Sola Properties account.</p>
      <p><a href="${verificationUrl}">Verify email address</a></p>
      <p>If you did not create this account, you can ignore this email.</p>
    `,
  });
}


export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<void> {
  const resetUrl =
    `http://localhost:3000/reset-password?token=${encodeURIComponent(token)}`;

  await transporter.sendMail({
    from: '"Sola Properties" <hello@example.com>',
    to: email,
    subject: "Reset your Sola Properties password",
    text: `Reset your password by opening this link: ${resetUrl}`,
    html: `
      <h2>Password reset</h2>
      <p>We received a request to reset your password.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
}
