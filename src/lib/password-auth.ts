"use server";

import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Auth.js's Credentials provider only supports JWT sessions, not the
// database-session model this app uses everywhere (Session table +
// authjs.session-token cookie) — and that model is what the realtime collab
// server's WS auth reads directly. Rather than switching the whole app to
// JWT (or fighting Credentials into working with an adapter), password
// login is a plain server action that creates a Session row the exact same
// way the adapter does for magic-link — auth() and every other consumer
// can't tell the difference.

const SESSION_COOKIE = "authjs.session-token";
const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60; // 30 days, matches Auth.js's own adapter default

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/");

  if (!email || !password) {
    redirect(`/signin?error=missing&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Same generic failure whether the email doesn't exist, has no password
  // set yet, or the password is wrong — never reveal which case.
  const hash = user?.password;
  const valid = hash ? await bcrypt.compare(password, hash) : false;
  if (!user || !valid) {
    redirect(`/signin?error=invalid&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const expires = new Date(Date.now() + SESSION_MAX_AGE_S * 1000);
  const session = await prisma.session.create({
    data: { sessionToken: randomUUID(), userId: user.id, expires },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, session.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
    secure: process.env.NODE_ENV === "production",
  });

  redirect(callbackUrl);
}

/** Sets/changes the current signed-in user's password. Being signed in — via
 *  a fresh magic-link click or an existing password session — is the only
 *  proof required; no separate reset token, since the magic-link flow above
 *  it already established identity. */
export async function setPassword(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    redirect("/signin/set-password?error=short");
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: session.user.id }, data: { password: hash } });

  redirect("/");
}
