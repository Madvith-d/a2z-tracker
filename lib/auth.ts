import { betterAuth } from "better-auth";
import { db } from "./db";

export const auth = betterAuth({
  appName: "A2Z DSA Roadmap",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: db,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: true,
    // Local accounts do not require an external mail service.
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // Always check the database so sign-out revokes access immediately.
    cookieCache: { enabled: false },
  },
  advanced: {
    // Local Docker also runs over HTTP. HTTPS deployments use Secure cookies.
    useSecureCookies: process.env.BETTER_AUTH_URL?.startsWith("https://") ?? false,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
});
