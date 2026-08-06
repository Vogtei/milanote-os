import { signIn } from "@/auth";

function safeRedirect(target: string | undefined) {
  if (!target) return "/";
  // Only allow same-origin relative paths — never forward an absolute URL
  // or protocol-relative "//host" value from the query string (open redirect).
  if (!target.startsWith("/") || target.startsWith("//")) return "/";
  return target;
}

export default async function SignInPage(props: PageProps<"/signin">) {
  const searchParams = await props.searchParams;
  const callbackUrl = safeRedirect(
    typeof searchParams.callbackUrl === "string" ? searchParams.callbackUrl : undefined,
  );

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          We&apos;ll email you a link to sign in — no password needed.
        </p>
        <form
          className="mt-6 flex flex-col gap-3"
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
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Send magic link
          </button>
        </form>
      </div>
    </div>
  );
}
