"use server";

import { signOut } from "@/auth";

// Sign-out used to live inline in the app layout's header; the layout no
// longer renders any chrome, so it moved here to be callable from the
// floating topbar menus on both the overview and board pages.
export async function signOutAction() {
  await signOut({ redirectTo: "/signin" });
}
