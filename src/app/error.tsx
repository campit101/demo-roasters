"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-16 sm:px-6 sm:pt-24">
      <h1 className="text-4xl sm:text-5xl">This page could not load</h1>
      <p className="mt-5 text-lg text-ink-soft">
        The page hit an error, usually because the database is waking up after a quiet spell. Trying again normally works.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-secondary">
          Go to the home page
        </Link>
      </div>
    </div>
  );
}
