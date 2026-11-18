import { useEffect, useRef, useState } from "react";

type Bike = { id: string; name: string; type: string };
type Msg = { role: "user" | "assistant"; content: string };
type Edit = { part: string; prompt: string };
type Version = { url: string; blob: Blob; label: string };

const IDEAS = ["Cambiar los rines", "Escape deportivo", "Otro color de tanque", "Manillar más bajo"];
const GREETING = "¡Hola! Cuéntame qué te gustaría cambiar en tu moto y te muestro cómo se vería.";

export default function App() {
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [bike, setBike] = useState<Bike | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [at, setAt] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: GREETING }]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Edit | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [dot, setDot] = useState<{ x: number; y: number } | null>(null);
  const [mask, setMask] = useState<{ url: string; blob: Blob } | null>(null);
  const [compare, setCompare] = useState(false);
  const [split, setSplit] = useState(50);
  const chatEnd = useRef<HTMLDivElement>(null);
  const current = versions[at];

  useEffect(() => {
    fetch("/api/catalog").then(r => r.json()).then(setBikes)
      .catch(() => setError("No pude conectar con el servidor. ¿Está corriendo el backend?"));
  }, []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  function loadPhoto(f?: File) {
    if (!f || !f.type.startsWith("image/")) { setError("Sube una imagen JPG o PNG."); return; }
    setError("");
    setVersions([{ url: URL.createObjectURL(f), blob: f, label: "Original" }]);
    setAt(0);
  }

  async function send(content: string) {
    if (!content.trim() || busy || !bike) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next); setText(""); setPending(null); setError(""); setBusy("Pensando…");
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: bike.name, messages: next.slice(1) }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "No pude hablar con la IA.");
      const d: { reply: string; edit: Edit | null } = await r.json();
      setMsgs([...next, { role: "assistant", content: d.reply }]);
      setPending(d.edit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude hablar con la IA. Revisa el backend y las claves.");
    }
    setBusy("");
  }

  async function pick(e: React.MouseEvent<HTMLImageElement>) {
    if (!pending || busy || !bike) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setDot({ x, y }); setError(""); setBusy("Detectando la pieza…");
    try {
      const fd = new FormData();
      fd.append("image", current.blob);
      fd.append("x", String(x)); fd.append("y", String(y));
      const res = await fetch("/api/segment", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "No pude detectar esa pieza.");
      const blob = await res.blob();
      setMask({ url: URL.createObjectURL(blob), blob });
      setBusy("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falló la edición.");
      setDot(null);
      setBusy("");
    }
  }

  async function applyEdit() {
    if (!mask || !pending || !bike || !current || busy) return;
    setBusy("Aplicando el cambio…"); setError("");
    try {
      const fd = new FormData();
      fd.append("image", current.blob); fd.append("mask_file", mask.blob);
      fd.append("x", String(dot?.x ?? 0.5)); fd.append("y", String(dot?.y ?? 0.5));
      fd.append("prompt", pending.prompt); fd.append("model", bike.name);
      const res = await fetch("/api/edit", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Falló la edición. Intenta de nuevo.");
      const blob = await res.blob();
      setVersions(v => [...v.slice(0, at + 1), { url: URL.createObjectURL(blob), blob, label: pending.part }]);
      setAt(at + 1);
      setMsgs(m => [...m, { role: "assistant", content: `Listo: ${pending.part} actualizado. ¿Qué más cambiamos?` }]);
      setPending(null);
      setMask(null); setDot(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falló la edición.");
    } finally { setBusy(""); }
  }

  if (!bike) return (
    <main className="start">
      <h1>Taller virtual</h1>
      <p>Elige tu moto, sube una foto y dile a la IA qué quieres cambiar. Verás el resultado al instante.</p>
      {error && <p className="error">{error}</p>}
      <div className="grid">
        {bikes.map(b => (
          <button key={b.id} className="bike" onClick={() => setBike(b)}>
            <strong>{b.name}</strong><span>{b.type}</span>
          </button>
        ))}
      </div>
    </main>
  );

  if (!current) return (
    <main className="start">
      <button className="link" onClick={() => setBike(null)}>Cambiar de moto</button>
      <h1>{bike.name}</h1>
      <p>Sube una foto de tu moto. Funciona mejor de lado, con buena luz y sin nada que la tape.</p>
      <label className="drop" onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); loadPhoto(e.dataTransfer.files[0]); }}>
        Arrastra una foto aquí o toca para elegirla
        <input type="file" accept="image/*" hidden onChange={e => loadPhoto(e.target.files?.[0])} />
      </label>
      {error && <p className="error">{error}</p>}
    </main>
  );

  return (
    <div className="app">
      <header>
        <strong>{bike.name}</strong>
        <div className="tools">
          <button disabled={at === 0 || !!busy} onClick={() => { setAt(at - 1); setPending(null); }}>Deshacer</button>
          <button disabled={at >= versions.length - 1 || !!busy} onClick={() => setAt(at + 1)}>Rehacer</button>
          <button disabled={at === 0} onClick={() => setCompare(!compare)}>{compare ? "Ocultar comparación" : "Comparar con original"}</button>
          <a className="btn" href={current.url} download="mi-moto-modificada.png">Descargar</a>
        </div>
      </header>

      <section className="stage-wrap">
        {pending && <div className="hint">{mask ? `Revisa la selección para: ${pending.part}` : `Toca en la foto: ${pending.part}`}</div>}
        <div className={"stage" + (pending && !mask ? " picking" : "")}>
          <img src={current.url} onClick={pick} alt="Tu moto" draggable={false} />
          {mask && <div className="mask-preview" style={{ maskImage: `url(${mask.url})`, WebkitMaskImage: `url(${mask.url})` }} aria-label="Vista previa de la pieza seleccionada" />}
          {compare && at > 0 && (<>
            <img className="over" src={versions[0].url} alt="" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} />
            <span className="tag" style={{ left: 8 }}>Antes</span>
            <span className="tag" style={{ right: 8 }}>Después</span>
            <input className="split" type="range" min={0} max={100} value={split}
              onChange={e => setSplit(+e.target.value)} aria-label="Comparar antes y después" />
          </>)}
          {dot && <span className="dot" style={{ left: dot.x * 100 + "%", top: dot.y * 100 + "%" }} />}
          {busy && dot && <div className="busy"><i />{busy}</div>}
        </div>
        {mask && <div className="mask-actions"><button onClick={() => { setMask(null); setDot(null); }}>Elegir otro punto</button><button className="primary" onClick={applyEdit} disabled={!!busy}>Aplicar cambio</button></div>}
        <div className="strip">
          {versions.map((v, i) => (
            <button key={i} className={i === at ? "on" : ""} disabled={!!busy}
              onClick={() => { setAt(i); setPending(null); }}>
              <img src={v.url} alt="" /><span>{v.label}</span>
            </button>
          ))}
        </div>
      </section>

      <aside>
        <div className="msgs">
          {msgs.map((m, i) => <p key={i} className={m.role}>{m.content}</p>)}
          {busy && !dot && <p className="assistant typing">{busy}</p>}
          <div ref={chatEnd} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {msgs.length === 1 && <div className="chips">{IDEAS.map(i => <button key={i} onClick={() => send(i)}>{i}</button>)}</div>}
        {pending && !busy && <button className="link" onClick={() => setPending(null)}>Cancelar este cambio</button>}
        <div className="compose">
          <input value={text} placeholder="Ej: rines dorados de 5 radios" disabled={!!busy}
            aria-label="Describe una modificación" onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send(text)} />
          <button onClick={() => send(text)} disabled={!!busy || !text.trim()}>Enviar</button>
        </div>
      </aside>
    </div>
  );
}
