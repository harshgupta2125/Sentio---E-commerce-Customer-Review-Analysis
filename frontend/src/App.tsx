import React from 'react';
import Home from './pages/Home';

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>Sentio — E‑commerce Review Analyzer</h1>
      </header>
      <main>
        <Home />
      </main>
    </div>
  );
}