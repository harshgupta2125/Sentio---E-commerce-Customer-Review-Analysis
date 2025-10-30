import axios from 'axios';
import { ReviewResponse } from '../types';

const api = axios.create({
  baseURL: '/api/v1', // proxied by vite to backend
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000
});

// add a small helper to ensure scheme is present
function ensureUrlHasScheme(u: string) {
  const trimmed = u.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return 'https://' + trimmed;
  }
  return trimmed;
}

export async function analyzeUrl(url: string) {
  const res = await fetch("/api/v1/reviews/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  // parse JSON if present
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    let msg: any = data?.detail ?? data ?? res.statusText;
    if (typeof msg === "object") {
      msg = msg.error || msg.advice || (msg.candidates ? JSON.stringify({ candidates: msg.candidates }) : JSON.stringify(msg));
    }
    throw new Error(String(msg));
  }

  return data;
}