"use client";

import { useState } from "react";

export function AdminAiBriefing() {
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cached, setCached] = useState(false);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/assistant/admin-summary", { method: "POST" });
      const data = await response.json() as { summary?: string; cached?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "The briefing could not be generated.");
      setSummary(data.summary || "No briefing is available yet.");
      setCached(Boolean(data.cached));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The briefing could not be generated.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="admin-section admin-ai-briefing" aria-labelledby="admin-ai-title">
    <div className="admin-section-heading"><div><p className="eyebrow">Aurel intelligence</p><h2 id="admin-ai-title">Store briefing</h2></div>
      <button className="button button--outline" type="button" onClick={() => void generate()} disabled={busy}>{busy ? "Preparing…" : error && !summary ? "Try again" : summary ? "Refresh briefing" : "Generate briefing"}</button>
    </div>
    <p className="admin-ai-disclaimer">A read-only summary of store activity and flagged patterns. Review the underlying records before making decisions.</p>
    {summary && <div className="admin-ai-summary"><p>{summary}</p>{cached && <small>Current summary · based on the latest available dashboard data</small>}</div>}
    {error && <p className="admin-alert" role="alert">{error}</p>}
  </section>;
}
