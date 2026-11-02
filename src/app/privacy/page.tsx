import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { ACCOUNTS, LIMITS } from "@/config/shop";
import { CONTACT_EMAIL, OWNER_NAME } from "@/config/site";

export const metadata: Metadata = { title: "Privacy", description: "What this demo shop stores about you, and why." };

export default function PrivacyPage() {
  return (
    <Prose title="Privacy" updated="26 October 2026">
      <p>
        Demo Roasters is a portfolio demo run by {OWNER_NAME}, who decides what it stores (the data controller). It is not a business and
        sells nothing. This page explains what it stores about you, why, and for how long. If anything here is unclear, email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>In your own browser</h2>
      <p>These stay on your device and are not sent to us, except your basket when you press Checkout.</p>
      <ul>
        <li>
          <strong>Theme</strong> (“theme”): light or dark, if you switch.
        </li>
        <li>
          <strong>Basket</strong> (“basket”): what you have added, until you check out or remove it.
        </li>
        <li>
          <strong>Checkout reference</strong> (“checkout-reference”): the reference of your latest test checkout, so the basket can empty
          itself once that order is paid.
        </li>
        <li>
          <strong>Sign-in cookie</strong>: one strictly necessary cookie keeps you signed in for up to {ACCOUNTS.sessionDays} days. It is
          not used for anything else.
        </li>
      </ul>
      <p>There is no advertising, no analytics and no tracking cookie, so there is no cookie banner.</p>

      <h2>On our servers</h2>
      <ul>
        <li>
          <strong>Your account, if you make one:</strong> your first name, your email address (any address works; we never email you), a
          scrambled (hashed) form of your password, and your sign-in sessions. No IP address and no browser details are kept with your
          account. Accounts are deleted automatically on or just after day {LIMITS.accountRetentionDays}, or straight away if you delete
          yours from your account page.
        </li>
        <li>
          <strong>Test orders:</strong> what was ordered, the grind, the prices and when. An order is linked to your account while the
          account exists; when the account is deleted, the order stays without any link to you. Unfinished checkouts are deleted after{" "}
          {LIMITS.unpaidOrderRetentionDays} days and paid test orders after {LIMITS.paidOrderRetentionDays} days.
        </li>
        <li>
          <strong>Search:</strong> each search records how many results it returned, how long it took and which part of the search ran.
          Never the words you typed, and nothing that identifies you. These records are deleted after {LIMITS.searchEventRetentionDays}{" "}
          days.
        </li>
        <li>
          <strong>Limits against abuse:</strong> a scrambled (hashed) form of your connection address, counted for up to a day so one
          visitor cannot overload the demo by searching, signing in, signing up or checking out again and again. Old counts are deleted
          every night.
        </li>
        <li>
          <strong>Request logs</strong> kept by our host, Vercel, such as your IP address and the address of the page you asked for (which
          includes any search words, because they are part of the search page’s address). They are kept for a short time under Vercel’s
          own rules so the site can run and be protected from abuse. We do not use them to follow you.
        </li>
        <li>
          <strong>Backups:</strong> our database provider keeps a short restore history, so deleted data can remain there for a limited
          time before it is gone for good.
        </li>
      </ul>

      <h2>Test payments</h2>
      <p>
        Checkout runs on Stripe’s own page in test mode. We send Stripe the items, the prices, the order reference and a made-up email
        address (demo-customer@example.com), never yours. Only Stripe’s published test card numbers work: never enter a real card. On its
        page Stripe collects what you type there (such as a name and postcode) and device details it uses against fraud, under its own
        privacy notice at <a href="https://stripe.com/gb/privacy">stripe.com/gb/privacy</a>. We keep only whether the test payment went
        through.
      </p>

      <h2>Why we may use it</h2>
      <p>
        Our lawful basis is legitimate interests: running a working demo shop that people can try, and keeping it secure and free of
        abuse. We keep only what that needs, for the times above. You can object to this at any time by emailing us; the simplest way to
        stop it is to delete your account and clear this site’s storage in your browser.
      </p>

      <h2>Who helps run the demo</h2>
      <ul>
        <li>Vercel Inc. hosts the website; the site’s server code runs in London.</li>
        <li>Neon Inc. hosts the database in London.</li>
        <li>Stripe Payments Europe Ltd handles test payments; no real money moves.</li>
      </ul>
      <p>
        Vercel and Neon are US companies, so your data may be reached from the United States, under the transfer safeguards in their data
        processing terms.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask to see, correct or delete anything stored about you, or object to its use, by emailing{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. If you are unhappy with the answer, you can complain to the Information
        Commissioner’s Office at <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk</a>.
      </p>
    </Prose>
  );
}
