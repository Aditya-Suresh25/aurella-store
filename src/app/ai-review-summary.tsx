"use client";

import { useState } from "react";

export function AiReviewSummary({ productSlug }: { productSlug: string }) {
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [insufficient, setInsufficient] = useState(false);

  async function loadSummary() {
    setBusy(true);
    setMessage("");
    setInsufficient(false);
    try {
      const response = await fetch("/api/assistant/review-summary", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: productSlug }),
      });
      const data = await response.json() as { state?: string; summary?: string; count?: number; error?: string };
      if (!response.ok) throw new Error(data.error || "Review summary is unavailable.");
      if (data.state === "insufficient") {
        setInsufficient(true);
        setMessage(`Not enough approved reviews yet. At least three are needed for a useful summary; this product has ${data.count ?? 0}.`);
      } else if (data.summary) setSummary(data.summary);
      else setMessage("A review summary is not available for this product.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review summary is unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="ai-review-summary" aria-label="AI review summary">
    <div className="ai-summary-heading"><div><p className="eyebrow">Review summary</p><h3>At a glance</h3></div>
      {!summary && <button className="text-link ai-summary-trigger" type="button" onClick={() => void loadSummary()} disabled={busy}>{busy ? "Reading reviews…" : message && !insufficient ? "Try again" : "Summarize reviews"}</button>}
    </div>
    {summary ? <p className="ai-summary-copy">{summary}</p> : message ? <p className={`ai-summary-message${insufficient ? "" : " ai-summary-message--error"}`} role="status">{message}</p> : <p className="ai-summary-hint">A short overview of themes in approved customer reviews.</p>}
  </section>;
}
