import { useRef, useState } from 'react';
import { exportBackup, importBackup, resetAll, useAppState } from '../lib/store';

export function Settings() {
  const { recipes, plan } = useAppState();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string>();

  const download = () => {
    const blob = new Blob([exportBackup()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `forkful-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const restore = async (file?: File) => {
    if (!file) return;
    try {
      importBackup(await file.text());
      setMessage('Varnostna kopija je obnovljena.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Obnova ni uspela.');
    }
  };

  return (
    <>
      <header className="page-header">
        <h1>Nastavitve</h1>
      </header>

      <section className="card">
        <h2>Tvoji podatki</h2>
        <p className="muted">
          {recipes.length} receptov · {plan.length} načrtovanih obrokov. Podatki so shranjeni samo v tem brskalniku.
        </p>
        <div className="action-row">
          <button className="btn" onClick={download}>
            ⬇️ Izvozi varnostno kopijo
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            ⬆️ Obnovi iz datoteke
          </button>
          <input ref={fileInput} type="file" accept="application/json" hidden onChange={(e) => restore(e.target.files?.[0])} />
        </div>
        {message && <p className="notice">{message}</p>}
      </section>

      <section className="card">
        <h2>Ponastavi</h2>
        <p className="muted">Izbriše vse recepte, načrt in nakupovalni seznam ter naloži primere receptov.</p>
        <button
          className="btn danger"
          onClick={() => confirm('Res želiš izbrisati vse podatke? Tega ni mogoče razveljaviti.') && resetAll()}
        >
          Izbriši vse podatke
        </button>
      </section>
    </>
  );
}
