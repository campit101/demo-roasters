import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-16 sm:px-6 sm:pt-24">
      <h1 className="text-4xl sm:text-5xl">That page is not on the shelf</h1>
      <p className="mt-5 text-lg text-ink-soft">The address may be mistyped, or the product may have been removed from the demo.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/shop/coffee" className="btn btn-primary">
          Browse coffee
        </Link>
        <Link href="/" className="btn btn-secondary">
          Go to the home page
        </Link>
      </div>
    </div>
  );
}
