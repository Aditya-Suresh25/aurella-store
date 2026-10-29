"use client";

import { useState, type FormEvent } from "react";

export function NewsletterForm() {
  const [subscribed, setSubscribed] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubscribed(true);
  }

  if (subscribed) {
    return <p className="newsletter-success" role="status">Thanks — this sample form is ready to connect.</p>;
  }

  return (
    <form className="newsletter-form" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="newsletter-email">Email address</label>
      <input
        id="newsletter-email"
        name="email"
        type="email"
        placeholder="Your email address"
        autoComplete="email"
        required
      />
      <button className="text-link" type="submit">Sign me up <span aria-hidden="true">→</span></button>
    </form>
  );
}
