import Link from "next/link";

const features = [
  {
    title: "Build the invoice",
    body: "Your business details, the client, and as many line items as you need. Totals and tax are worked out as you type.",
  },
  {
    title: "Export to PDF",
    body: "One click gives you an A4 PDF you can email to a client or file for your accountant.",
  },
  {
    title: "Keep them",
    body: "Every invoice you create is saved to your account, so you can come back and download it again later.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
      <header className="flex items-center justify-between">
        <span className="font-mono text-sm tracking-tight">invoicer</span>
        <Link
          href="/login"
          className="border-line rounded-md border px-3 py-1.5 text-sm hover:bg-white"
        >
          Sign in
        </Link>
      </header>

      <main className="mt-20 sm:mt-28">
        <h1 className="max-w-2xl text-4xl leading-tight font-medium tracking-tight sm:text-5xl">
          Invoices for people who would rather not open a spreadsheet.
        </h1>
        <p className="text-muted mt-5 max-w-xl text-lg">
          Fill in the details, get a clean PDF. Free to use, and a Pro plan that removes
          the watermark from your exports.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            className="bg-ink rounded-md px-4 py-2.5 text-sm text-white hover:opacity-90"
          >
            Create an invoice
          </Link>
          <span className="text-muted text-sm">No card needed to start.</span>
        </div>

        <section className="border-line mt-24 grid gap-8 border-t pt-10 sm:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title}>
              <h2 className="text-sm font-medium">{feature.title}</h2>
              <p className="text-muted mt-2 text-sm leading-relaxed">{feature.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-2">
          <div className="border-line bg-surface rounded-lg border p-6">
            <h2 className="text-sm font-medium">Free</h2>
            <p className="mt-1 text-2xl font-medium tracking-tight">EUR 0</p>
            <ul className="text-muted mt-4 space-y-2 text-sm">
              <li>Unlimited invoices</li>
              <li>PDF export</li>
              <li>Watermark on every export</li>
            </ul>
          </div>
          <div className="border-ink bg-surface rounded-lg border p-6">
            <h2 className="text-sm font-medium">Pro</h2>
            <p className="mt-1 text-2xl font-medium tracking-tight">
              EUR 9 <span className="text-muted text-sm font-normal">/ month</span>
            </p>
            <ul className="text-muted mt-4 space-y-2 text-sm">
              <li>Everything in Free</li>
              <li>Clean PDF export, no watermark</li>
              <li>Cancel any time</li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-line text-muted mt-24 border-t pt-6 text-sm">
        A portfolio project. Payments run in Stripe test mode.
      </footer>
    </div>
  );
}
