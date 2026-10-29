import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { OWNER_NAME } from "@/config/site";

export const metadata: Metadata = { title: "About this demo", description: "What Demo Roasters is, what it shows, and how it was built." };

export default function AboutPage() {
  return (
    <Prose title="About this demo">
      <p>
        Demo Roasters is a portfolio project by {OWNER_NAME}. It is a pretend specialty coffee shop, built to show the parts of a
        real online shop working together.
      </p>
      <h2>What it shows</h2>
      <ul>
        <li>A catalogue of invented coffees, brewing gear and gift sets, with live stock, filters (including by taste) and product pages. Built.</li>
        <li>Search that understands plain English, such as &ldquo;decaf under £12&rdquo; or &ldquo;fruity coffee for filter&rdquo;. Built.</li>
        <li>A basket that remembers what you add on your own device, and checkout on Stripe’s own page in test mode. Built.</li>
        <li>Customer accounts with order history. Built.</li>
        <li>An admin dashboard for products, stock and orders, with a read-only demo login. Built.</li>
      </ul>
      <h2>How it is built</h2>
      <p>
        Next.js on Vercel, a Postgres database at Neon in London, and Stripe in test mode. Search uses a small open AI model that
        runs on the site’s own server, so it costs nothing per search. Product and home page photos are AI-generated from written descriptions
        with FLUX.2 [pro] by Black Forest Labs. Each coffee’s colour on
        the site comes from its main taste.
      </p>
      <h2>Also by {OWNER_NAME}</h2>
      <p>
        <a href="https://polisher-demo.vercel.app">Polisher</a>, a writing tool (also a demo).
      </p>
    </Prose>
  );
}
