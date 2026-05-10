import { expo } from "@better-auth/expo";
import { db } from "@pruvi/db";
import * as schema from "@pruvi/db/schema/auth";
import { env } from "@pruvi/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resend } from "resend";

const resend = new Resend(env.RESEND_API_KEY);

const appleProvider =
  env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET && env.APPLE_BUNDLE_ID
    ? {
        apple: {
          clientId: env.APPLE_CLIENT_ID,
          clientSecret: env.APPLE_CLIENT_SECRET,
          appBundleIdentifier: env.APPLE_BUNDLE_ID,
        },
      }
    : {};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  trustedOrigins: [
    env.CORS_ORIGIN,
    "mybettertapp://",
    ...(env.NODE_ENV === "development"
      ? ["exp://", "exp://**", "exp://192.168.*.*:*/**", "http://localhost:8081"]
      : []),
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: user.email,
        subject: "Verifique seu e-mail no Pruvi",
        html: `<p>Olá ${user.name ?? ""}, confirme seu e-mail clicando no link abaixo:</p><p><a href="${url}">${url}</a></p>`,
      });
    },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    ...appleProvider,
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      httpOnly: true,
    },
  },
  plugins: [expo()],
});
