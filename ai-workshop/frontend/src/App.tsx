import { useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, CircleHelp,
  Download, Eye, EyeOff, Gauge, ImagePlus, LogIn, LogOut, Menu, MessageCircle,
  Moon, MoreHorizontal, RotateCcw, ShieldCheck, Sparkles, UserRound, X,
} from "lucide-react";

type Bike = { id: string; name: string; type: string };
type Msg = { role: "user" | "assistant"; content: string };
type Edit = { part: string; prompt: string };
type Version = { url: string; blob: Blob; label: string };
type User = { id: number; name: string; email: string };
type Screen = "home" | "studio";
type AuthMode = "login" | "signup";
type ServiceStatus = { chat_ready: boolean; image_ready: boolean; ai_is_simulated: false };

const CATALOG: Bike[] = [
  { id: "gixxer-sf-250", name: "Suzuki Gixxer SF 250", type: "Deportiva" },
  { id: "r15", name: "Yamaha R15", type: "Deportiva" },
  { id: "ninja-400", name: "Kawasaki Ninja 400", type: "Deportiva" },
  { id: "ns200", name: "Bajaj Pulsar NS200", type: "Naked" },
  { id: "duke-200", name: "KTM Duke 200", type: "Naked" },
  { id: "fz-20", name: "Yamaha FZ 2.0", type: "Naked" },
  { id: "cb190r", name: "Honda CB190R", type: "Naked" },
  { id: "classic-350", name: "Royal Enfield Classic 350", type: "Clásica" },
];
const SAMPLE: Record<string, { file: string; label: string; detail: string }> = {
  Deportiva: { file: "sport.webp", label: "Deportiva", detail: "Carénado y líneas aerodinámicas" },
  Naked: { file: "naked.webp", label: "Naked", detail: "Motor y estructura a la vista" },
  Clásica: { file: "classic.webp", label: "Clásica", detail: "Silueta retro y detalles cromados" },
};
const GREETING = "¡Listo! Esta es una foto de muestra para empezar. Dime qué quieres personalizar; la IA real te indicará qué parte seleccionar.";
const IDEAS = ["Rines color bronce", "Escape deportivo negro", "Tanque verde oliva", "Manillar estilo café racer"];

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  return body.detail || fallback;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [bikes, setBikes] = useState<Bike[]>(CATALOG);
  const [bike, setBike] = useState<Bike | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [at, setAt] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Edit | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [dot, setDot] = useState<{ x: number; y: number } | null>(null);
  const [mask, setMask] = useState<{ url: string; blob: Blob } | null>(null);
  const [compare, setCompare] = useState(false);
  const [split, setSplit] = useState(50);
  const [filter, setFilter] = useState("Todas");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [accountView, setAccountView] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const accountModal = useRef<HTMLElement>(null);
  const filteredBikes = bikes.filter(b => filter === "Todas" || b.type === filter);
  const current = versions[at];

  useEffect(() => {
    fetch("/api/catalog").then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: Bike[]) => setBikes(data)).catch(() => setCatalogError("El backend no responde. Puedes recorrer la experiencia, pero el chat y la edición necesitan el servidor."));
    fetch("/api/auth/me").then(r => r.json()).then(d => setUser(d.user)).catch(() => undefined);
    fetch("/api/status").then(r => r.json()).then(setServiceStatus).catch(() => setServiceStatus({ chat_ready: false, image_ready: false, ai_is_simulated: false }));
  }, []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => {
    if (!authOpen && !accountView) return;
    accountModal.current?.querySelector<HTMLElement>("input, button")?.focus();
    const modalKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setAuthOpen(false); setAccountView(false); }
      if (event.key === "Tab" && accountModal.current) {
        const focusable = Array.from(accountModal.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]'));
        if (!focusable.length) return;
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", modalKeys);
    return () => window.removeEventListener("keydown", modalKeys);
  }, [authOpen, accountView]);

  function goToModels() {
    setMobileMenu(false);
    document.getElementById("motos")?.scrollIntoView({ behavior: "smooth" });
  }

  async function startSample(selectedBike: Bike) {
    const sample = SAMPLE[selectedBike.type] || SAMPLE.Naked;
    const response = await fetch(`/samples/${sample.file}`);
    const blob = await response.blob();
    const version = { url: URL.createObjectURL(blob), blob, label: "Foto de muestra" };
    setBike(selectedBike); setVersions([version]); setAt(0); setScreen("studio"); setMask(null); setDot(null);
    setMsgs([{ role: "assistant", content: `${GREETING} Representa el estilo ${sample.label}; no es una fotografía del modelo ${selectedBike.name}.` }]);
    setPending(null); setError(""); setCompare(false); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function loadPhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Elige una imagen JPG, PNG o WebP."); return; }
    const version = { url: URL.createObjectURL(file), blob: file, label: "Mi foto" };
    setVersions(v => [...v.slice(0, at + 1), version]); setAt(at + 1); setError(""); setPending(null); setMask(null); setDot(null);
    setMsgs(m => [...m, { role: "assistant", content: "Foto lista. Cuéntame qué te gustaría cambiar." }]);
  }

  async function send(content: string) {
    if (!content.trim() || busy || !bike) return;
    const next = [...msgs, { role: "user" as const, content: content.trim() }];
    setMsgs(next); setText(""); setPending(null); setMask(null); setDot(null); setError(""); setBusy("Conectando con la IA…");
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: bike.name, messages: next.slice(1) }),
      });
      if (!response.ok) throw new Error(await readError(response, "No pude conectar con Anthropic."));
      const data: { reply: string; edit: Edit | null } = await response.json();
      setMsgs([...next, { role: "assistant", content: data.reply }]); setPending(data.edit);
    } catch (err) { setError(err instanceof Error ? err.message : "No pude conectar con la IA. Revisa el servidor y las claves."); }
    setBusy("");
  }

  async function selectPart(event: React.MouseEvent<HTMLImageElement>) {
    if (!pending || busy || !bike || !current || mask) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setDot({ x, y }); setBusy("Identificando la pieza con SAM 2…"); setError("");
    try {
      const form = new FormData(); form.append("image", current.blob); form.append("x", String(x)); form.append("y", String(y));
      const response = await fetch("/api/segment", { method: "POST", body: form });
      if (!response.ok) throw new Error(await readError(response, "No pude identificar esa pieza."));
      const blob = await response.blob(); setMask({ url: URL.createObjectURL(blob), blob });
    } catch (err) { setError(err instanceof Error ? err.message : "Falló la detección de la pieza."); setDot(null); }
    setBusy("");
  }

  async function applyEdit() {
    if (!mask || !pending || !bike || !current || busy) return;
    setBusy("Aplicando el cambio con Flux…"); setError("");
    try {
      const form = new FormData(); form.append("image", current.blob); form.append("mask_file", mask.blob);
      form.append("x", String(dot?.x ?? 0.5)); form.append("y", String(dot?.y ?? 0.5));
      form.append("prompt", pending.prompt); form.append("model", bike.name);
      const response = await fetch("/api/edit", { method: "POST", body: form });
      if (!response.ok) throw new Error(await readError(response, "No pude aplicar el cambio."));
      const blob = await response.blob();
      setVersions(v => [...v.slice(0, at + 1), { url: URL.createObjectURL(blob), blob, label: pending.part }]);
      setAt(at + 1); setMsgs(m => [...m, { role: "assistant", content: `Listo: ${pending.part} actualizado. El resultado se generó con Flux Fill.` }]);
      setPending(null); setMask(null); setDot(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Falló la edición. Inténtalo de nuevo."); }
    setBusy("");
  }

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthError(""); setAuthBusy(true);
    const form = new FormData(event.currentTarget);
    const payload = authMode === "signup"
      ? { name: String(form.get("name") || ""), email: String(form.get("email") || ""), password: String(form.get("password") || "") }
      : { email: String(form.get("email") || ""), password: String(form.get("password") || "") };
    try {
      const response = await fetch(`/api/auth/${authMode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(await readError(response, "No pude completar la solicitud."));
      const data = await response.json(); setUser(data.user); setAuthOpen(false); setAccountView(false);
    } catch (err) { setAuthError(err instanceof Error ? err.message : "Revisa tu conexión e inténtalo de nuevo."); }
    setAuthBusy(false);
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null); setAccountView(false);
  }

  function goHome() {
    setScreen("home"); setBike(null); setVersions([]); setAt(0); setPending(null); setMask(null); setError(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="site-shell">
      {screen === "home" ? (
        <>
          <header className="site-nav">
            <a className="brand" href="#inicio" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label="MotoMod, inicio">
              <span className="brand-mark">M<span>·</span></span><span className="brand-word">MOTOMOD<small>TALLER DIGITAL</small></span>
            </a>
            <nav className={mobileMenu ? "nav-links open" : "nav-links"} aria-label="Navegación principal">
              <a href="#como-funciona" onClick={() => setMobileMenu(false)}>Cómo funciona</a>
              <a href="#motos" onClick={() => setMobileMenu(false)}>Explorar motos</a>
              <a href="#preguntas" onClick={() => setMobileMenu(false)}>Preguntas</a>
            </nav>
            <div className="nav-actions">
              {user ? <button className="nav-account" onClick={() => setAccountView(true)}><UserRound size={16} />{user.name.split(" ")[0]}</button>
                : <button className="nav-login" onClick={() => { setAuthMode("login"); setAuthOpen(true); }}>Iniciar sesión</button>}
              <button className="nav-cta" onClick={goToModels}>Probar ahora <ArrowRight size={16} /></button>
            </div>
            <button className="menu-toggle" onClick={() => setMobileMenu(v => !v)} aria-label={mobileMenu ? "Cerrar menú" : "Abrir menú"}>{mobileMenu ? <X /> : <Menu />}</button>
          </header>

          <main id="inicio">
            <section className="hero">
              <div className="hero-bg" aria-hidden="true" />
              <div className="hero-content">
                <div className="eyebrow"><span className="eyebrow-line" /> TU MOTO, TUS REGLAS</div>
                <h1>La próxima versión<br />de tu moto <em>empieza aquí.</em></h1>
                <p>Visualiza tus ideas antes de llevarlas al taller. Elige una moto de muestra o sube una foto y modifica cada detalle con IA.</p>
                <div className="hero-actions">
                  <button className="button-primary" onClick={goToModels}>Elegir una moto <ArrowRight size={18} /></button>
                  <a href="#como-funciona" className="hero-secondary">Descubre cómo funciona <ArrowDown size={16} /></a>
                </div>
                <div className="hero-proof"><div className="proof-dot"><Sparkles size={14} /></div><span><b>Ediciones con IA real</b><br />Tu foto, transformada por ti.</span></div>
              </div>
              <div className="hero-caption"><span className="caption-line" /> INSPIRACIÓN · NAKED STREET <span>01 / 03</span></div>
              <div className="hero-image-note"><Sparkles size={13} /> Imagen de inspiración generada</div>
            </section>

            <section className="trust-strip" aria-label="Ventajas">
              <div><ShieldCheck /><span><b>Uso transparente de tu foto</b><small>fal.ai la procesa al editar</small></span></div>
              <div><Gauge /><span><b>Empieza en segundos</b><small>Sin formularios obligatorios</small></span></div>
              <div><Sparkles /><span><b>Conectores de IA reales</b><small>Sin respuestas pregrabadas</small></span></div>
              <div className="trust-last"><Moon /><span><b>Sin registro obligatorio</b><small>Entra directo al taller</small></span></div>
            </section>

            {catalogError && <div className="inline-warning"><CircleHelp size={16} />{catalogError}</div>}
            {serviceStatus && (!serviceStatus.chat_ready || !serviceStatus.image_ready) && <div className="inline-warning"><CircleHelp size={16} /><span>Para activar el chat y las ediciones reales, configura <b>ANTHROPIC_API_KEY</b> y <b>FAL_KEY</b> en el backend.</span></div>}

            <section className="models-section section-pad" id="motos">
              <div className="section-heading">
                <div><div className="eyebrow dark"><span className="eyebrow-line" /> TU PRIMERA VUELTA</div><h2>Elige tu punto de partida.</h2><p>Prueba el taller al instante con una foto de muestra. También puedes reemplazarla por la tuya.</p></div>
                <div className="catalog-count"><b>08</b><span>MODELOS<br />DISPONIBLES</span></div>
              </div>
              <div className="filters" role="group" aria-label="Filtrar modelos de moto">
                {["Todas", "Deportiva", "Naked", "Clásica"].map(item => <button key={item} className={filter === item ? "filter-chip selected" : "filter-chip"} onClick={() => setFilter(item)}>{item}</button>)}
                <span className="filter-note"><Sparkles size={14} /> Fotos de muestra incluidas</span>
              </div>
              <div className="bike-grid">
                {filteredBikes.map((item, i) => {
                  const sample = SAMPLE[item.type] || SAMPLE.Naked;
                  return <article className="bike-card" key={item.id} style={{ animationDelay: `${i * 45}ms` }}>
                    <button className="bike-photo" onClick={() => void startSample(item)} aria-label={`Probar ${item.name} con foto de muestra`} style={{ backgroundImage: `url(/samples/${sample.file})` }}>
                      <span className="bike-category">{item.type.toUpperCase()}</span><span className="bike-card-arrow"><ArrowUpRightIcon /></span>
                    </button>
                    <div className="bike-info"><div><span className="bike-make">MOTO DE REFERENCIA</span><h3>{item.name}</h3><p>{sample.detail}</p></div><button className="bike-start" onClick={() => void startSample(item)} aria-label={`Probar ${item.name}`}><ArrowRight size={18} /></button></div>
                  </article>;
                })}
              </div>
              <p className="sample-disclaimer"><CircleHelp size={15} /> Las imágenes son referencias visuales generadas por categoría; no representan fotografías exactas de cada modelo.</p>
            </section>

            <section className="how-section section-pad" id="como-funciona">
              <div className="how-art" role="img" aria-label="Motocicleta de muestra preparada para personalización">
                <img src="/samples/classic.webp" alt="Moto clásica de muestra" loading="lazy" />
                <div className="art-tag"><span /> SELECCIÓN INTELIGENTE</div>
                <div className="art-callout"><Sparkles size={16} /><span>La IA identifica la pieza<br /><b>tú eliges qué cambiar</b></span></div>
              </div>
              <div className="how-copy">
                <div className="eyebrow dark"><span className="eyebrow-line" /> FÁCIL, VISUAL, TUYO</div><h2>De la idea a la imagen.<br /><em>Así de sencillo.</em></h2>
                <div className="steps">
                  <div className="step"><span className="step-number">01</span><div><h3>Elige o sube</h3><p>Empieza con una moto de referencia o una foto lateral de la tuya.</p></div></div>
                  <div className="step"><span className="step-number">02</span><div><h3>Cuéntale a Claude</h3><p>Describe tu idea con tus palabras. La IA concreta la pieza y el estilo.</p></div></div>
                  <div className="step"><span className="step-number">03</span><div><h3>Señala y transforma</h3><p>Revisa la máscara detectada por SAM 2 y aplica el cambio con Flux Fill.</p></div></div>
                </div>
                <button className="text-link" onClick={goToModels}>Empezar a explorar <ArrowRight size={16} /></button>
              </div>
            </section>

            <section className="cta-band">
              <div className="cta-glow" /><div className="eyebrow"><span className="eyebrow-line" /> GARAGE ABIERTO</div>
              <h2>Tu idea merece<br />verse <em>en grande.</em></h2>
              <p>No necesitas cuenta para probar. Solo una idea y ganas de experimentar.</p>
              <button className="button-primary" onClick={goToModels}>Entrar al taller <ArrowRight size={18} /></button>
              <div className="cta-stamp">M<br /><span>·</span></div>
            </section>

            <section className="faq-section section-pad" id="preguntas">
              <div className="faq-intro"><div className="eyebrow dark"><span className="eyebrow-line" /> ANTES DE ARRANCAR</div><h2>Preguntas rápidas.</h2><p>Lo esencial para entrar al taller con confianza.</p></div>
              <div className="faq-list">
                <details><summary>¿Necesito crear una cuenta para probar? <ChevronDown size={18} /></summary><p>No. Puedes elegir un modelo y comenzar en el momento. La cuenta es opcional y sirve para identificar tu sesión en este dispositivo.</p></details>
                <details><summary>¿Las modificaciones son imágenes reales? <ChevronDown size={18} /></summary><p>Sí. Cuando las claves del servidor están configuradas, el chat consulta Claude y las imágenes se editan con SAM 2 y Flux Fill. Si un servicio no está disponible, verás un error; nunca se reemplaza por una respuesta simulada.</p></details>
                <details><summary>¿Puedo usar la foto de mi moto? <ChevronDown size={18} /></summary><p>Sí. Entra con cualquier moto de muestra y usa “Subir mi foto” en el taller. Una vista lateral bien iluminada ayuda a detectar mejor las piezas. Al editar, la imagen se envía a fal.ai para segmentación e inpainting; MotoMod no la publica ni la guarda en la cuenta.</p></details>
              </div>
            </section>
          </main>

          <footer className="site-footer"><a className="brand footer-brand" href="#inicio"><span className="brand-mark">M<span>·</span></span><span className="brand-word">MOTOMOD<small>TALLER DIGITAL</small></span></a><span>Diseñado para imaginar lo que viene.</span><div><a href="#como-funciona">Cómo funciona</a><button onClick={() => { setAuthMode("signup"); setAuthOpen(true); }}>Crear cuenta</button><a href="#preguntas">Ayuda</a></div><small>© 2026 MotoMod · Proyecto académico</small></footer>
        </>
      ) : (
        <main className="studio-page">
          <header className="studio-header">
            <button className="studio-back" onClick={goHome}><ArrowLeft size={17} /><span>Salir del taller</span></button>
            <a className="brand studio-brand" href="#inicio" onClick={e => { e.preventDefault(); goHome(); }}><span className="brand-mark">M<span>·</span></span><span className="brand-word">MOTOMOD<small>TALLER DIGITAL</small></span></a>
            <div className="studio-menu"><span className="studio-bike-name">{bike?.name}</span><button className="studio-account" onClick={() => user ? setAccountView(true) : (setAuthMode("signup"), setAuthOpen(true))}>{user ? <UserRound size={16} /> : <LogIn size={16} />}{user ? user.name.split(" ")[0] : "Crear cuenta"}</button></div>
          </header>
          <div className="studio-layout">
            <section className="studio-workspace">
              <div className="studio-toolbar"><div><span className="studio-kicker">ESPACIO DE DISEÑO</span><h1>{bike?.name}</h1></div><div className="toolbar-controls"><button disabled={at === 0 || !!busy} onClick={() => { setAt(at - 1); setPending(null); setMask(null); }}><RotateCcw size={15} />Deshacer</button><button disabled={at >= versions.length - 1 || !!busy} onClick={() => setAt(at + 1)}>Rehacer</button><button disabled={at === 0} onClick={() => setCompare(v => !v)}><Eye size={15} />{compare ? "Vista única" : "Comparar"}</button><a className="tool-download" href={current?.url} download="mi-moto-modificada.png"><Download size={15} />Guardar</a></div></div>
              <div className="canvas-wrap">
                {current && <>
                  {pending && <div className="selection-hint"><Sparkles size={15} />{mask ? `Revisa la máscara de ${pending.part}` : `Toca la pieza que quieres cambiar: ${pending.part}`}</div>}
                  <div className={`canvas${pending && !mask ? " is-selecting" : ""}`}>
                    <img className="canvas-main" src={current.url} onClick={selectPart} alt={`${bike?.name}, ${current.label}`} draggable={false} />
                    {mask && <div className="mask-preview" style={{ maskImage: `url(${mask.url})`, WebkitMaskImage: `url(${mask.url})` }} />}
                    {compare && at > 0 && <><img className="compare-before" src={versions[0].url} alt="Vista anterior" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} /><span className="compare-label before-label">ANTES</span><span className="compare-label after-label">AHORA</span><input className="compare-slider" type="range" min="0" max="100" value={split} onChange={e => setSplit(Number(e.target.value))} aria-label="Desliza para comparar antes y después" /></>}
                    {dot && <span className="selection-dot" style={{ left: `${dot.x * 100}%`, top: `${dot.y * 100}%` }} />}
                    {busy && <div className="canvas-progress"><span className="spinner" />{busy}</div>}
                  </div>
                  {mask && <div className="mask-confirm"><span><Check size={15} /> Área detectada</span><button onClick={() => { setMask(null); setDot(null); }}>Cambiar punto</button><button className="confirm-button" onClick={applyEdit} disabled={!!busy}>Aplicar cambio <ArrowRight size={15} /></button></div>}
                  <div className="version-strip" aria-label="Historial de imágenes">{versions.map((version, i) => <button key={`${version.label}-${i}`} className={i === at ? "version-card active" : "version-card"} disabled={!!busy} onClick={() => { setAt(i); setPending(null); setMask(null); }}><img src={version.url} alt="" /><span><b>{version.label}</b><small>{i === 0 ? "Original" : `Versión ${i + 1}`}</small></span></button>)}</div>
                  <div className="canvas-footnote"><span><ShieldCheck size={14} />Tu imagen no se publica</span><span>{current.label === "Foto de muestra" ? "Referencia generada · no es el modelo exacto" : "Procesada para esta edición"}</span></div>
                </>}
              </div>
            </section>
            <aside className="chat-panel">
              <div className="chat-heading"><div className="chat-avatar"><Sparkles size={17} /></div><div><b>Copiloto de diseño</b><span className={serviceStatus?.chat_ready ? "provider-ready" : "provider-offline"}><i />{serviceStatus?.chat_ready ? "Claude · API real activa" : "Claude · falta configurar API"}</span></div><button onClick={() => setMsgs([{ role: "assistant", content: GREETING }])} title="Nueva conversación"><MoreHorizontal size={19} /></button></div>
              <div className="chat-context"><MessageCircle size={14} /><span>Diseñando para <b>{bike?.name}</b></span></div>
              {serviceStatus && (!serviceStatus.chat_ready || !serviceStatus.image_ready) && <div className="service-warning"><CircleHelp size={14} /><span>{!serviceStatus.chat_ready && !serviceStatus.image_ready ? "Configura ANTHROPIC_API_KEY y FAL_KEY en backend/.env para activar IA real." : !serviceStatus.chat_ready ? "Falta ANTHROPIC_API_KEY para el chat real." : "Falta FAL_KEY para segmentar y editar imágenes."}</span></div>}
              <div className="chat-messages" aria-live="polite">
                {msgs.map((message, i) => <div key={i} className={`chat-bubble ${message.role}`}><p>{message.content}</p>{message.role === "assistant" && i > 0 && <small><Sparkles size={11} /> Claude</small>}</div>)}
                {busy && !dot && <div className="chat-bubble assistant"><div className="typing-dots"><i /><i /><i /></div><small>{busy}</small></div>}
                <div ref={chatEnd} />
              </div>
              {error && <div className="chat-error" role="alert"><CircleHelp size={16} /><span>{error}</span></div>}
              {msgs.length <= 1 && <div className="prompt-suggestions"><span>IDEAS PARA EMPEZAR</span>{IDEAS.map(idea => <button key={idea} onClick={() => void send(idea)} disabled={!!busy}>{idea}<ArrowUpRightIcon /></button>)}</div>}
              {pending && !busy && !mask && <div className="part-prompt"><Sparkles size={15} /><span>Claude sugiere modificar <b>{pending.part}</b>. Ahora toca esa pieza en la foto.</span></div>}
              {pending && !busy && <button className="cancel-edit" onClick={() => { setPending(null); setMask(null); setDot(null); }}>Cancelar selección</button>}
              <div className="chat-compose"><textarea value={text} rows={2} disabled={!!busy} placeholder="Describe tu idea…" aria-label="Describe la modificación" onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }} /><button className="send-button" onClick={() => void send(text)} disabled={!!busy || !text.trim()} aria-label="Enviar mensaje"><ArrowRight size={18} /></button><small>Enter para enviar · Shift + Enter para una nueva línea</small></div>
            </aside>
          </div>
          <div className="studio-bottom-bar"><span><Sparkles size={14} /> Tu imaginación conduce.</span><button onClick={() => fileInput.current?.click()}><ImagePlus size={15} />Subir mi foto</button><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => loadPhoto(e.target.files?.[0])} /><button onClick={goHome}>Cambiar de moto <ChevronRight size={15} /></button></div>
        </main>
      )}

      {(authOpen || accountView) && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setAuthOpen(false); setAccountView(false); } }}>
        <section ref={accountModal} className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title">
          <button className="modal-close" onClick={() => { setAuthOpen(false); setAccountView(false); }} aria-label="Cerrar"><X size={19} /></button>
          {accountView && user ? <>
            <div className="account-icon"><UserRound size={21} /></div><div className="eyebrow dark"><span className="eyebrow-line" /> MI GARAJE</div><h2 id="account-title">Hola, {user.name.split(" ")[0]}.</h2><p className="account-copy">Tu cuenta está lista. Puedes seguir usando el taller en este dispositivo.</p>
            <div className="account-details"><span>Nombre</span><b>{user.name}</b><span>Correo electrónico</span><b>{user.email}</b><span>Cuenta creada</span><b>Sesión protegida</b></div>
            <div className="account-note"><CircleHelp size={15} />Las fotos e historial actuales permanecen en esta sesión; todavía no se guardan en la nube.</div>
            <button className="account-submit signout" onClick={() => void signOut()}><LogOut size={16} />Cerrar sesión</button>
          </> : <>
            <div className="account-icon"><Sparkles size={21} /></div><div className="eyebrow dark"><span className="eyebrow-line" /> {authMode === "signup" ? "BIENVENIDO AL GARAJE" : "QUÉ BUENO VERTE"}</div>
            <h2 id="account-title">{authMode === "signup" ? "Crea tu cuenta." : "Entra a tu cuenta."}</h2>
            <p className="account-copy">{authMode === "signup" ? "Guarda tu perfil en este dispositivo y vuelve al taller cuando quieras." : "Inicia sesión para identificar tu perfil en este dispositivo."}</p>
            <form className="account-form" onSubmit={submitAuth}>
              {authMode === "signup" && <label>Nombre<input name="name" autoComplete="name" required minLength={2} maxLength={60} placeholder="Cómo te llamamos" /></label>}
              <label>Correo electrónico<input name="email" type="email" autoComplete="email" required placeholder="tu@correo.com" /></label>
              <div className="account-field"><label htmlFor="account-password">Contraseña</label><span className="password-wrap"><input id="account-password" name="password" type={showPassword ? "text" : "password"} autoComplete={authMode === "signup" ? "new-password" : "current-password"} required minLength={authMode === "signup" ? 10 : 1} placeholder={authMode === "signup" ? "Mínimo 10 caracteres" : "Tu contraseña"} /><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></div>
              {authError && <p className="auth-error" role="alert">{authError}</p>}
              <button className="account-submit" type="submit" disabled={authBusy}>{authBusy ? "Un momento…" : authMode === "signup" ? "Crear cuenta" : "Iniciar sesión"}<ArrowRight size={17} /></button>
            </form>
            <p className="account-switch">{authMode === "signup" ? "¿Ya tienes cuenta?" : "¿Primera vez por aquí?"} <button onClick={() => { setAuthMode(authMode === "signup" ? "login" : "signup"); setAuthError(""); }}>{authMode === "signup" ? "Inicia sesión" : "Crea una cuenta"}</button></p>
            <p className="account-optional">Crear cuenta es opcional. Puedes seguir probando sin registrarte.</p>
          </>}
        </section>
      </div>}
    </div>
  );
}

function ArrowUpRightIcon() { return <ArrowRight size={15} className="arrow-up-right" aria-hidden="true" />; }
