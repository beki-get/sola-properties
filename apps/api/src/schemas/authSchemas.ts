import { z } from "zod";

// Public registration: privileged roles cannot self-register.
const publicRegistrationRoles = ["buyer", "agent", "developer"] as const;

const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .max(255)
  .transform((email) => email.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must not exceed 128 characters");

// 1. Registration
export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(150),
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(publicRegistrationRoles),
  })
  .strict();

// 2. Login
export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

// Shared format for cryptographically generated token strings.
// Adjust the bounds if the token-generation format differs.
const tokenSchema = z.string().min(32).max(512);

// 3. Email verification
export const verifyEmailSchema = z
  .object({
    token: tokenSchema,
  })
  .strict();

// Resend verification email
export const resendVerificationSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

// 4. Request password reset
export const requestPasswordResetSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

// Complete password reset
export const resetPasswordSchema = z
  .object({
    token: tokenSchema,
    newPassword: passwordSchema,
  })
  .strict();

// 5. Refresh
// The refresh token is expected in its HttpOnly cookie,
// not in the request body.
export const refreshSchema = z.object({}).strict();

// 6. Logout
// The refresh token is expected in its HttpOnly cookie,
// not in the request body.
export const logoutSchema = z.object({}).strict();
