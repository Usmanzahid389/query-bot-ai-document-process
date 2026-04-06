import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Query smarter documents
        </h1>
        <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          QueryBot is an MVP web app for uploading PDF, DOCX, and TXT files and asking questions in natural
          language. Summaries, multi-document chat, and side-by-side comparison use mock AI responses for
          integration testing.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/register"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Create account
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Log in
        </Link>
        <Link
          href="/documents"
          className="rounded-lg border border-transparent px-4 py-2 text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          Go to documents
        </Link>
      </div>
    </div>
  );
}
