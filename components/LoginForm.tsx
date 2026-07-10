"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "../app/dashboard.css";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se pudo iniciar sesión.");
        return;
      }
      const next = searchParams.get("next") || "/gestion";
      router.push(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="viz-root">
      <div className="wrap" style={{ maxWidth: 380, paddingTop: 80 }}>
        <header className="page-head">
          <h1>RCT Operativo</h1>
          <p className="sub">Ingresa la contraseña para ver esta sección.</p>
        </header>
        <form className="comments-form" style={{ marginTop: 20, flexDirection: "column", alignItems: "stretch" }} onSubmit={submit}>
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <div style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</div>}
          <button type="submit" disabled={busy || !password}>{busy ? "Ingresando…" : "Ingresar"}</button>
        </form>
      </div>
    </div>
  );
}
