import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { CONTACT_EMAIL, OWNER_NAME } from "@/config/site";

export const metadata: Metadata = { title: "Terms", description: "The terms for using this demo shop." };

export default function TermsPage() {
  return (
    <Prose title="Terms" updated="26 October 2026">
      <p>
        Demo Roasters is a portfolio demo built by {OWNER_NAME} to show how an online shop works. By using it you agree to these
        terms.
      </p>
      <h2>Nothing is for sale</h2>
      <p>
        No product here exists. Prices, stock, delivery costs and orders are part of the demo. Placing a test order does not create
        a contract, and nothing will be posted to you. Stock is pretend too: a product that sells out restocks itself straight away,
        and everything is restocked every night.
      </p>
      <h2>Test payments only</h2>
      <p>
        Checkout runs in Stripe’s test mode. Only Stripe’s published test card numbers work and no money moves. Never enter real
        card details.
      </p>
      <h2>Made-up content</h2>
      <p>
        Every product, farm, washing station, person and description is invented for the demo. Coffee-growing countries are
        real origins, and a product name may borrow a real growing region (such as Cerrado in Brazil) as a name only: nothing here
        describes a real farm or producer.
      </p>
      <h2>Fair use</h2>
      <p>
        Please do not try to overload the demo or break into accounts that are not yours. Accounts and test orders may be reset at
        any time, and accounts are deleted on or just after day 30.
      </p>
      <h2>No promises</h2>
      <p>
        The demo is provided as it is, for looking around. It may change, break or go offline without notice.
      </p>
      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </Prose>
  );
}
