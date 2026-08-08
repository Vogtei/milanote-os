import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { setPassword } from "@/lib/password-auth";

// Reached two ways, both already fully authenticated by the time they get
// here: (1) a brand-new user's first magic-link click, gated in from
// (app)/layout.tsx because they have no password yet; (2) "Passwort
// vergessen?" on /signin — same magic-link flow, now acting as a reset.
// Either way, being signed in already proves email ownership, so this is
// just a plain form, no separate token to consume.
export default async function SetPasswordPage(props: PageProps<"/signin/set-password">) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const searchParams = await props.searchParams;
  const error = searchParams.error === "short" ? "Mindestens 8 Zeichen." : null;

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Passwort festlegen
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Damit du dich künftig direkt mit E-Mail und Passwort anmelden kannst, statt jedes Mal
          einen neuen Link per E-Mail anzufordern.
        </p>

        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <form action={setPassword} className="mt-6 flex flex-col gap-3">
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoFocus
            placeholder="Neues Passwort"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Passwort speichern
          </button>
        </form>
      </div>
    </div>
  );
}
