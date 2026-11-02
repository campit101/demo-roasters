import Link from "next/link";
import { CATEGORY_PAGES } from "@/config/categories";
import { DELIVERY } from "@/config/shop";
import { CONTACT_EMAIL } from "@/config/site";
import { formatPrice, formatPounds } from "@/lib/format";

const heading = "text-sm font-semibold";
const link = "text-[0.95rem] text-ink-soft hover:text-ink";

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-sand">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="max-w-sm">
          <p className="text-xl font-extrabold tracking-tight" translate="no">
            DEMO ROASTERS
          </p>
          <p className="mt-3 text-[0.95rem] text-ink-soft">
            A portfolio demo by Cam. Nothing here is for sale and payments are test only. Every product, farm and person in the
            catalogue is invented.
          </p>
        </div>
        <nav aria-label="Shop links">
          <p className={heading}>Shop</p>
          <ul className="mt-3 space-y-2">
            {CATEGORY_PAGES.map((c) => (
              <li key={c.slug}>
                <Link href={`/shop/${c.slug}`} className={link}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className={heading}>Delivery</p>
          <p className="mt-3 text-[0.95rem] text-ink-soft">
            {formatPrice(DELIVERY.flatPence)} to the UK, free over {formatPounds(DELIVERY.freeFromPence)}. Pretend only: nothing is ever
            posted.
          </p>
        </div>
        <nav aria-label="About this demo">
          <p className={heading}>About</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/about" className={link}>
                About this demo
              </Link>
            </li>
            <li>
              <Link href="/privacy" className={link}>
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className={link}>
                Terms
              </Link>
            </li>
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className={`${link} break-all`}>
                {CONTACT_EMAIL}
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
