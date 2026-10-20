import "dotenv/config";
import { pool } from "../src/config/database";
import { hashPassword } from "../src/utils/password";

type SeedUser = {
  fullName: string;
  email: string;
  password: string;
  role: "admin" | "finance_admin";
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function upsertPrivilegedUser(user: SeedUser): Promise<void> {
  const normalizedEmail = user.email.toLowerCase();
  const passwordHash = await hashPassword(user.password);

  // The conflict target matches the existing unique index on LOWER(email).
  // The WHERE clause prevents accidentally changing a different role into a privileged account.
  const result = await pool.query(
    `
      INSERT INTO users (
        full_name,
        email,
        password_hash,
        role,
        status,
        email_verified_at
      )
      VALUES ($1, $2, $3, $4::app_role, 'approved'::account_status, NOW())
      ON CONFLICT ((LOWER(email)))
      DO UPDATE SET
        full_name = EXCLUDED.full_name,
        password_hash = EXCLUDED.password_hash,
        status = 'approved'::account_status,
        email_verified_at = NOW(),
        updated_at = NOW()
      WHERE users.role = EXCLUDED.role
      RETURNING id, email, role, status, email_verified_at
    `,
    [
      user.fullName,
      normalizedEmail,
      passwordHash,
      user.role,
    ],
  );

  if (result.rowCount !== 1) {
    throw new Error(
      `The email ${normalizedEmail} already belongs to a user with a different role. ` +
      `Choose a dedicated seed email; no role change was made.`,
    );
  }

  const row = result.rows[0];
  console.log(`Seeded ${row.role}: ${row.email} (${row.status}, email verified)`);
}

async function main(): Promise<void> {
  const users: SeedUser[] = [
    {
      fullName: process.env.SEED_ADMIN_FULL_NAME?.trim() || "Sola Test Admin",
      email: requiredEnv("SEED_ADMIN_EMAIL"),
      password: requiredEnv("SEED_ADMIN_PASSWORD"),
      role: "admin",
    },
    {
      fullName:
        process.env.SEED_FINANCE_ADMIN_FULL_NAME?.trim() ||
        "Sola Test Finance Admin",
      email: requiredEnv("SEED_FINANCE_ADMIN_EMAIL"),
      password: requiredEnv("SEED_FINANCE_ADMIN_PASSWORD"),
      role: "finance_admin",
    },
  ];

  if (users[0].email.toLowerCase() === users[1].email.toLowerCase()) {
    throw new Error("Admin and finance-admin must use different email addresses.");
  }

  await upsertPrivilegedUser(users[0]);
  await upsertPrivilegedUser(users[1]);
}

main()
  .catch((error: unknown) => {
    console.error("Privileged test-user seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
