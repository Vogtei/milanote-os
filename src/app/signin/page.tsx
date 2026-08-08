import { signIn } from "@/auth";
import { signInWithPassword } from "@/lib/password-auth";

function safeRedirect(target: string | undefined) {
  if (!target) return "/";
  // Only allow same-origin relative paths — never forward an absolute URL
  // or protocol-relative "//host" value from the query string (open redirect).
  if (!target.startsWith("/") || target.startsWith("//")) return "/";
  return target;
}

const ERRORS: Record<string, string> = {
  invalid: "E-Mail oder Passwort ist falsch.",
  missing: "Bitte E-Mail und Passwort eingeben.",
};

export default async function SignInPage(props: PageProps<"/signin">) {
  const searchParams = await props.searchParams;
  const callbackUrl = safeRedirect(
    typeof searchParams.callbackUrl === "string" ? searchParams.callbackUrl : undefined,
  );
  const errorParam = typeof searchParams.error === "string" ? searchParams.error : undefined;
  const error = errorParam ? (ERRORS[errorParam] ?? "Anmeldung fehlgeschlagen.") : null;

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Melde dich mit deiner E-Mail und deinem Passwort an.
        </p>

        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <form action={signInWithPassword} className="mt-6 flex flex-col gap-3">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50"
          />
          <input
            type="password"
            name="password"
            required
            placeholder="Passwort"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Anmelden
          </button>
        </form>

        <details className="mt-5 text-sm text-zinc-600 dark:text-zinc-400">
          <summary className="cursor-pointer select-none">
            Kein Passwort? Passwort vergessen?
          </summary>
          <form
            className="mt-3 flex flex-col gap-3"
            action={async (formData) => {
              "use server";
              await signIn("nodemailer", {
                email: formData.get("email"),
                redirectTo: callbackUrl,
              });
            }}
          >
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50"
            />
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
            >
              Anmelde-Link per E-Mail senden
            </button>
          </form>
        </details>
      </div>
    </div>
  );
}
