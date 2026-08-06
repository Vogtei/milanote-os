export default function VerifyRequestPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Check your email
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          A sign-in link was sent to your inbox. In local dev, open{" "}
          <a
            href="http://localhost:1080"
            className="underline"
          >
            the Maildev inbox
          </a>{" "}
          to find it.
        </p>
      </div>
    </div>
  );
}
