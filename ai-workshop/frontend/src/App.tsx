import { useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, CircleHelp,
  Download, Eye, EyeOff, FolderOpen, Gauge, ImagePlus, LogIn, LogOut, Menu, MessageCircle,
  Accessibility, Contrast, Languages, Moon, MoreHorizontal, RotateCcw, Settings2, ShieldCheck, Sparkles, Sun, Type, UserRound, X,
  Trash2,
} from "lucide-react";
import { apiFetch } from "./api";
import { localeNames, translate, type Locale } from "./i18n";
import { deleteGarageEntry, listGarageEntries, saveGarageEntry, type GarageEntry } from "./garageStorage";

type Bike = { id: string; name: string; type: string };
type Msg = { role: "user" | "assistant"; content: string };
type Edit = { part: string; prompt: string };
type Version = { id: string; url: string; blob: Blob; label: string };
type User = { id: number; name: string; email: string };
type Screen = "home" | "garage" | "workshop" | "studio";
type AuthMode = "login" | "signup";
type ServiceStatus = { chat_ready: boolean; image_ready: boolean; ai_is_simulated: false };
type BrushPoint = { x: number; y: number };
type BrushStroke = { points: BrushPoint[]; width: number };
type SampleInfo = { file: string; detail: string; assistantNote: string; studioNote: string };

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
const SAMPLE: Record<string, SampleInfo> = {
  "gixxer-sf-250": { file: "gixxer-sf-250.jpg", detail: "2022 · foto de referencia", assistantNote: "La versión de la foto es 2022; el color puede variar.", studioNote: "Foto de referencia del modelo · año o color pueden variar" },
  r15: { file: "r15.jpg", detail: "2014 · foto de referencia", assistantNote: "La versión de la foto es 2014; el color puede variar.", studioNote: "Foto de referencia del modelo · año o color pueden variar" },
  "ninja-400": { file: "ninja-400.jpg", detail: "2018 · foto de referencia", assistantNote: "La versión de la foto es 2018; el color puede variar.", studioNote: "Foto de referencia del modelo · año o color pueden variar" },
  ns200: { file: "ns200.jpg", detail: "Foto de referencia del modelo", assistantNote: "El año y el color pueden variar.", studioNote: "Foto de referencia del modelo · año o color pueden variar" },
  "duke-200": { file: "duke-200.jpg", detail: "Foto de referencia del modelo", assistantNote: "El año y el color pueden variar.", studioNote: "Foto de referencia del modelo · año o color pueden variar" },
  "fz-20": { file: "fz-20.jpg", detail: "FZ-S · versión 2.0 no confirmada", assistantNote: "La imagen muestra una Yamaha FZ-S; no pude confirmar que sea la versión 2.0.", studioNote: "Yamaha FZ-S · versión 2.0 no confirmada" },
  cb190r: { file: "cb190r.jpg", detail: "CB 190R Repsol · foto de referencia", assistantNote: "La foto muestra la decoración Repsol; el color puede variar.", studioNote: "Foto de referencia del modelo · decoración Repsol" },
  "classic-350": { file: "classic-350.jpg", detail: "2017 · foto de referencia", assistantNote: "La versión de la foto es 2017; el color puede variar.", studioNote: "Foto de referencia del modelo · año o color pueden variar" },
};
const GREETING = "¡Hola! Cuéntame qué te gustaría cambiar en tu moto y te muestro cómo se vería.";
const IDEAS = [
  "Rines color bronce", "Escape deportivo negro", "Tanque verde oliva", "Manillar estilo café racer",
  "Pinta la moto en azul eléctrico", "Agrega una franja dorada al tanque", "Cambia el asiento por uno café",
  "Ponle espejos más pequeños", "Haz que el guardabarros sea negro mate", "Cambia el faro por uno redondo LED",
  "Agrega detalles rojos en los rines", "Dale un estilo scrambler", "Ponle un escape cromado corto",
  "Cambia el tanque a color crema", "Agrega una parrilla trasera discreta", "Pinta las tapas laterales de negro",
  "Haz el asiento más deportivo", "Añade una línea blanca al tanque", "Cambia el manillar por uno más bajo",
  "Dale un acabado verde militar mate",
];

function pickIdeas(locale: Locale, count = 4) {
  const shuffled = [...IDEAS];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled.slice(0, count).map(idea => translate(locale, idea));
}

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  return body.detail || fallback;
}

async function prepareReferencePhoto(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No pude preparar la foto de referencia.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const optimized = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("No pude comprimir la foto de referencia.")), "image/jpeg", 0.82));
  const encoded = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error || new Error("No pude leer la foto de referencia."));
    reader.readAsDataURL(optimized);
  });
  return { reference_image: encoded, reference_mime_type: "image/jpeg" };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => window.location.hash.startsWith("#/taller") ? "workshop" : window.location.hash === "#/garaje" ? "garage" : "home");
  const [bikes, setBikes] = useState<Bike[]>(CATALOG);
  const [bike, setBike] = useState<Bike | null>(null);
  const [ownVehicleName, setOwnVehicleName] = useState("");
  const [ownVehicleType, setOwnVehicleType] = useState("Otra");
  const [ownPhoto, setOwnPhoto] = useState<File | null>(null);
  const [ownPhotoUrl, setOwnPhotoUrl] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [at, setAt] = useState(0);
  const [garageId, setGarageId] = useState<string | null>(null);
  const [garageCreatedAt, setGarageCreatedAt] = useState<number | null>(null);
  const [garageEntries, setGarageEntries] = useState<GarageEntry[]>([]);
  const [garageError, setGarageError] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem("motomod-locale");
    return saved === "en" || saved === "pt" || saved === "fr" ? saved : "es";
  });
  const [suggestions, setSuggestions] = useState<string[]>(() => pickIdeas(locale));
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Edit | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [strokes, setStrokes] = useState<BrushStroke[]>([]);
  const [painting, setPainting] = useState(false);
  const [brushSize, setBrushSize] = useState(42);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [compare, setCompare] = useState(false);
  const [split, setSplit] = useState(50);
  const [filter, setFilter] = useState("Todas");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [accountView, setAccountView] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => localStorage.getItem("motomod-theme") === "dark" ? "dark" : "light");
  const [largeText, setLargeText] = useState(() => localStorage.getItem("motomod-large-text") === "true");
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem("motomod-high-contrast") === "true");
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem("motomod-reduced-motion") === "true");
  const [showPassword, setShowPassword] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [catalogError, setCatalogError] = useState<{ key: string; name?: string } | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const canvasImage = useRef<HTMLImageElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const ownPhotoInput = useRef<HTMLInputElement>(null);
  const accountModal = useRef<HTMLElement>(null);
  const filteredBikes = bikes.filter(b => filter === "Todas" || b.type === filter);
  const currentSample = bike ? SAMPLE[bike.id] : undefined;
  const current = versions[at];
  const t = (key: string) => translate(locale, key);

  useEffect(() => { setSuggestions(pickIdeas(locale)); }, [locale]);

  useEffect(() => { setStrokes([]); setPainting(false); setImageDimensions(null); }, [current?.url]);
  useEffect(() => () => { if (ownPhotoUrl) URL.revokeObjectURL(ownPhotoUrl); }, [ownPhotoUrl]);

  useEffect(() => {
    const syncRoute = () => {
      const route = window.location.hash;
      if (route === "#/garaje") setScreen("garage");
      else if (route === "#/taller") setScreen("workshop");
      else if (route === "#/taller/estudio") setScreen(bike ? "studio" : "workshop");
      else setScreen("home");
    };
    window.addEventListener("popstate", syncRoute);
    window.addEventListener("hashchange", syncRoute);
    return () => {
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener("hashchange", syncRoute);
    };
  }, [bike]);

  useEffect(() => {
    apiFetch("/api/catalog").then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: Bike[]) => setBikes(data)).catch(() => setCatalogError({ key: "El backend no responde. Puedes recorrer la experiencia, pero el chat y la edición necesitan el servidor." }));
    apiFetch("/api/auth/me").then(r => r.json()).then(d => setUser(d.user)).catch(() => undefined);
    apiFetch("/api/status").then(r => r.json()).then(setServiceStatus).catch(() => setServiceStatus({ chat_ready: false, image_ready: false, ai_is_simulated: false }));
  }, []);
  useEffect(() => {
    void listGarageEntries().then(setGarageEntries).catch(() => setGarageError(true));
  }, []);
  useEffect(() => {
    if (!bike || !versions.length || !garageId) return;
    const existing = garageEntries.find(entry => entry.id === garageId);
    const unchanged = existing && existing.bikeId === bike.id && existing.bikeName === bike.name && existing.bikeType === bike.type && existing.versions.length === versions.length
      && existing.versions.every((version, index) => version.id === versions[index]?.id);
    if (unchanged) return;
    const now = Date.now();
    const entry: GarageEntry = {
      id: garageId,
      bikeId: bike.id,
      bikeName: bike.name,
      bikeType: bike.type,
      createdAt: garageCreatedAt || now,
      updatedAt: now,
      versions: versions.map(version => ({ id: version.id, label: version.label, blob: version.blob })),
    };
    void saveGarageEntry(entry).then(() => listGarageEntries()).then(setGarageEntries).catch(() => setGarageError(true));
  }, [bike, versions, garageId, garageCreatedAt, garageEntries]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = locale;
    document.documentElement.classList.toggle("accessibility-large-text", largeText);
    document.documentElement.classList.toggle("accessibility-high-contrast", highContrast);
    document.documentElement.classList.toggle("accessibility-reduced-motion", reducedMotion);
    localStorage.setItem("motomod-theme", theme);
    localStorage.setItem("motomod-locale", locale);
    localStorage.setItem("motomod-large-text", String(largeText));
    localStorage.setItem("motomod-high-contrast", String(highContrast));
    localStorage.setItem("motomod-reduced-motion", String(reducedMotion));
  }, [theme, locale, largeText, highContrast, reducedMotion]);
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

  function openWorkshop() {
    setMobileMenu(false);
    setError("");
    window.history.pushState({}, "", `${window.location.pathname}${window.location.search}#/taller`);
    setScreen("workshop");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openGarage() {
    setMobileMenu(false);
    window.history.pushState({}, "", `${window.location.pathname}${window.location.search}#/garaje`);
    setScreen("garage");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openStudioRoute() {
    window.history.pushState({}, "", `${window.location.pathname}${window.location.search}#/taller/estudio`);
    setScreen("studio");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function startSample(selectedBike: Bike) {
    const sample = SAMPLE[selectedBike.id];
    if (!sample) {
      setCatalogError({ key: "Todavía no hay una foto de referencia para", name: selectedBike.name });
      return;
    }
    try {
      const response = await fetch(`/samples/${sample.file}`);
      if (!response.ok) throw new Error(t("No pude cargar la foto de referencia. Inténtalo de nuevo."));
      const blob = await response.blob();
      const version = { id: crypto.randomUUID(), url: URL.createObjectURL(blob), blob, label: "Foto de muestra" };
      setGarageId(crypto.randomUUID()); setGarageCreatedAt(Date.now());
      setBike(selectedBike); setVersions([version]); setAt(0); setStrokes([]);
      setSuggestions(pickIdeas(locale));
      setMsgs([{ role: "assistant", content: `${t("¡Listo! Cargué una foto de referencia de")} ${selectedBike.name}. ${t(sample.assistantNote)} ${t("Dime qué quieres personalizar.")}` }]);
      setPending(null); setError(""); setCompare(false); openStudioRoute();
    } catch (err) {
      setError(err instanceof Error ? t(err.message) : t("No pude cargar la foto de referencia."));
      setScreen("workshop");
    }
  }

  function startOwnVehicle() {
    const name = ownVehicleName.trim();
    if (name.length < 2) { setError(t("Escribe la marca o el modelo de tu moto.")); return; }
    if (!ownPhoto) { setError(t("Sube una foto de tu moto para empezar.")); return; }
    const selectedBike: Bike = { id: `propia-${Date.now()}`, name, type: ownVehicleType };
    const version = { id: crypto.randomUUID(), url: URL.createObjectURL(ownPhoto), blob: ownPhoto, label: "Mi foto" };
    setGarageId(crypto.randomUUID()); setGarageCreatedAt(Date.now());
    setBike(selectedBike); setVersions([version]); setAt(0); setStrokes([]);
    setSuggestions(pickIdeas(locale));
    setMsgs([{ role: "assistant", content: t("¡Listo! Ya tengo tu moto y tu foto. Cuéntame qué quieres personalizar.") }]);
    setPending(null); setError(""); setCompare(false); openStudioRoute();
  }

  function loadPhoto(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError(t("Elige una imagen JPG, PNG o WebP.")); return; }
    const version = { id: crypto.randomUUID(), url: URL.createObjectURL(file), blob: file, label: "Mi foto" };
    setVersions(v => [...v.slice(0, at + 1), version]); setAt(at + 1); setError(""); setPending(null); setStrokes([]);
    setSuggestions(pickIdeas(locale));
    setMsgs(m => [...m, { role: "assistant", content: t("Foto lista. Cuéntame qué te gustaría cambiar.") }]);
  }

  function selectOwnPhoto(file?: File) {
    if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError(t("Elige una imagen JPG, PNG o WebP.")); return; }
    setOwnPhoto(file || null);
    setOwnPhotoUrl(file ? URL.createObjectURL(file) : "");
    setError("");
  }

  async function send(content: string) {
    if (!content.trim() || busy || !bike || !current) return;
    const next = [...msgs, { role: "user" as const, content: content.trim() }];
    setMsgs(next); setText(""); setPending(null); setStrokes([]); setError(""); setBusy(t("Conectando con la IA…"));
    try {
      const response = await apiFetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: bike.name, messages: next.slice(1), language: locale, ...await prepareReferencePhoto(current.blob) }),
      });
      if (!response.ok) throw new Error(t(await readError(response, "No pude conectar con Gemini.")));
      const data: { reply: string; edit: Edit | null } = await response.json();
      setMsgs([...next, { role: "assistant", content: data.reply }]); setPending(data.edit);
    } catch (err) { setError(err instanceof Error ? t(err.message) : t("No pude conectar con la IA. Revisa el servidor y las claves.")); }
    setBusy("");
  }

  function brushPoint(event: React.PointerEvent<SVGSVGElement>) {
    const image = canvasImage.current;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!image || !rect.width || !rect.height) return null;
    return {
      x: Math.max(0, Math.min(image.naturalWidth, (event.clientX - rect.left) / rect.width * image.naturalWidth)),
      y: Math.max(0, Math.min(image.naturalHeight, (event.clientY - rect.top) / rect.height * image.naturalHeight)),
    };
  }

  function startPainting(event: React.PointerEvent<SVGSVGElement>) {
    if (!pending || busy || !current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = brushPoint(event);
    const image = canvasImage.current;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!point || !image || !rect.width) return;
    const width = brushSize * image.naturalWidth / rect.width;
    setStrokes(previous => [...previous, { points: [point], width }]);
    setPainting(true); setError("");
  }

  function continuePainting(event: React.PointerEvent<SVGSVGElement>) {
    if (!painting) return;
    const point = brushPoint(event);
    if (!point) return;
    setStrokes(previous => previous.map((stroke, index) => index === previous.length - 1
      ? { ...stroke, points: [...stroke.points, point] }
      : stroke));
  }

  function finishPainting() {
    setPainting(false);
  }

  async function createMask(image: HTMLImageElement) {
    const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error(t("No pude preparar la selección. Recarga la foto y vuelve a pintar."));
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(scale, scale);
    context.strokeStyle = "#fff";
    context.fillStyle = "#fff";
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of strokes) {
      context.lineWidth = stroke.width;
      const [first, ...rest] = stroke.points;
      if (!first) continue;
      if (rest.length === 0) {
        context.beginPath(); context.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2); context.fill();
        continue;
      }
      context.beginPath(); context.moveTo(first.x, first.y);
      for (const point of rest) context.lineTo(point.x, point.y);
      context.stroke();
    }
    return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(t("No pude generar la máscara de selección."))), "image/png"));
  }

  async function applyEdit() {
    const image = canvasImage.current;
    if (!strokes.length || !image || !pending || !bike || !current || busy) return;
    setBusy(t("Aplicando el cambio con Stability AI…")); setError("");
    try {
      const form = new FormData(); form.append("image", current.blob);
      form.append("mask_file", await createMask(image), "seleccion.png");
      form.append("prompt", pending.prompt); form.append("part", pending.part); form.append("model", bike.name);
      const response = await apiFetch("/api/edit", { method: "POST", body: form });
      if (!response.ok) throw new Error(t(await readError(response, "No pude aplicar el cambio.")));
      const blob = await response.blob();
      setVersions(v => [...v.slice(0, at + 1), { id: crypto.randomUUID(), url: URL.createObjectURL(blob), blob, label: pending.part }]);
      setAt(at + 1); setMsgs(m => [...m, { role: "assistant", content: `${t("Listo:")} ${pending.part} ${t("actualizado con Stability AI.")}` }]);
      setPending(null); setStrokes([]);
    } catch (err) { setError(err instanceof Error ? t(err.message) : t("Falló la edición. Inténtalo de nuevo.")); }
    setBusy("");
  }

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthError(""); setAuthBusy(true);
    const form = new FormData(event.currentTarget);
    const payload = authMode === "signup"
      ? { name: String(form.get("name") || ""), email: String(form.get("email") || ""), password: String(form.get("password") || "") }
      : { email: String(form.get("email") || ""), password: String(form.get("password") || "") };
    try {
      const response = await apiFetch(`/api/auth/${authMode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(t(await readError(response, "No pude completar la solicitud.")));
      const data = await response.json(); setUser(data.user); setAuthOpen(false); setAccountView(false);
    } catch (err) { setAuthError(err instanceof Error ? t(err.message) : t("Revisa tu conexión e inténtalo de nuevo.")); }
    setAuthBusy(false);
  }

  async function signOut() {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null); setAccountView(false);
  }

  function openGarageEntry(entry: GarageEntry) {
    setBike({ id: entry.bikeId || `garage-${entry.id}`, name: entry.bikeName, type: entry.bikeType });
    setVersions(entry.versions.map(version => ({ ...version, id: version.id || crypto.randomUUID(), url: URL.createObjectURL(version.blob) })));
    setAt(entry.versions.length - 1);
    setGarageId(entry.id); setGarageCreatedAt(entry.createdAt);
    setMsgs([{ role: "assistant", content: t("Proyecto cargado desde tu garaje.") }]);
    setPending(null); setStrokes([]); setError(""); setCompare(false);
    window.history.pushState({}, "", `${window.location.pathname}${window.location.search}#/taller/estudio`);
    setScreen("studio");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeGarageEntry(entry: GarageEntry) {
    if (!window.confirm(t("¿Eliminar esta moto y su historial guardado de este dispositivo?"))) return;
    try {
      await deleteGarageEntry(entry.id);
      setGarageEntries(await listGarageEntries());
      if (garageId === entry.id) setGarageId(null);
      setGarageError(false);
    } catch {
      setGarageError(true);
    }
  }

  function goHome() {
    window.history.pushState({}, "", `${window.location.pathname}${window.location.search}`);
    setScreen("home"); setBike(null); setVersions([]); setAt(0); setGarageId(null); setGarageCreatedAt(null); setPending(null); setStrokes([]); setError(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="site-shell">
      {screen === "garage" ? (
        <main className="garage-page">
          <header className="studio-header">
            <button className="studio-back" onClick={goHome}><ArrowLeft size={17} /><span>{t("Volver a MotoMod")}</span></button>
            <a className="brand studio-brand" href="#inicio" onClick={e => { e.preventDefault(); goHome(); }}><MotoMark /><span className="brand-word">MOTOMOD<small>{t("TALLER DIGITAL")}</small></span></a>
            <div className="studio-menu"><PreferencesMenu locale={locale} setLocale={setLocale} t={t} theme={theme} setTheme={setTheme} largeText={largeText} setLargeText={setLargeText} highContrast={highContrast} setHighContrast={setHighContrast} reducedMotion={reducedMotion} setReducedMotion={setReducedMotion} /><button className="studio-account" onClick={openWorkshop}><ArrowRight size={16} />{t("Abrir taller")}</button></div>
          </header>
          <section className="garage-intro">
            <div><div className="eyebrow dark"><span className="eyebrow-line" /> {t("TU ESPACIO PERSONAL")}</div><h1>{t("Mi garaje.")}</h1><p>{t("Tus motos, fotos originales y cambios guardados en este dispositivo.")}</p></div>
            <button className="button-primary" onClick={openWorkshop}>{t("Añadir una moto")} <ArrowRight size={17} /></button>
          </section>
          {garageError && <div className="inline-warning" role="alert"><CircleHelp size={16} />{t("No se pudo acceder al garaje local. Comprueba el espacio disponible del navegador.")}</div>}
          {garageEntries.length ? <section className="garage-grid" aria-label={t("Motos guardadas")}>
            {garageEntries.map(entry => <GarageCard key={entry.id} entry={entry} locale={locale} t={t} onOpen={() => openGarageEntry(entry)} onDelete={() => void removeGarageEntry(entry)} />)}
          </section> : <section className="garage-empty"><div className="garage-empty-icon"><FolderOpen size={28} /></div><h2>{t("Tu garaje está vacío")}</h2><p>{t("Empieza con una moto del catálogo o sube una foto. La guardaremos aquí junto a cada modificación.")}</p><button className="button-primary" onClick={openWorkshop}>{t("Probar una moto ahora")} <ArrowRight size={17} /></button></section>}
          <p className="garage-local-note"><ShieldCheck size={15} />{t("El garaje se guarda en este navegador y dispositivo; no se sincroniza con la nube.")}</p>
        </main>
      ) : screen === "home" ? (
        <>
          <header className="site-nav">
            <a className="brand" href="#inicio" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label={t("MotoMod, inicio")}>
              <MotoMark /><span className="brand-word">MOTOMOD<small>{t("TALLER DIGITAL")}</small></span>
            </a>
            <nav className={mobileMenu ? "nav-links open" : "nav-links"} aria-label={t("Navegación principal")}>
              <a href="#/taller" onClick={e => { e.preventDefault(); openWorkshop(); }}>{t("Taller virtual")}</a>
              <a href="#como-funciona" onClick={() => setMobileMenu(false)}>{t("Cómo funciona")}</a>
              <a href="#motos" onClick={() => setMobileMenu(false)}>{t("Explorar motos")}</a>
              <a href="#/garaje" onClick={e => { e.preventDefault(); openGarage(); }}>{t("Mi garaje")}</a>
              <a href="#preguntas" onClick={() => setMobileMenu(false)}>{t("Preguntas")}</a>
            </nav>
            <div className="nav-actions">
              {user ? <button className="nav-account" onClick={() => setAccountView(true)}><UserRound size={16} />{user.name.split(" ")[0]}</button>
                : <button className="nav-login" onClick={() => { setAuthMode("login"); setAuthOpen(true); }}>{t("Iniciar sesión")}</button>}
              <PreferencesMenu locale={locale} setLocale={setLocale} t={t} theme={theme} setTheme={setTheme} largeText={largeText} setLargeText={setLargeText} highContrast={highContrast} setHighContrast={setHighContrast} reducedMotion={reducedMotion} setReducedMotion={setReducedMotion} />
              <button className="nav-cta" onClick={openWorkshop}>{t("Abrir taller")} <ArrowRight size={16} /></button>
            </div>
            <button className="menu-toggle" onClick={() => setMobileMenu(v => !v)} aria-label={t(mobileMenu ? "Cerrar menú" : "Abrir menú")}>{mobileMenu ? <X /> : <Menu />}</button>
          </header>

          <main id="inicio">
            <section className="hero">
              <div className="hero-bg" aria-hidden="true" />
              <div className="hero-content">
                <div className="eyebrow"><span className="eyebrow-line" /> {t("TU MOTO, TUS REGLAS")}</div>
                <h1>{t("La próxima versión")}<br />{t("de tu moto ")}<em>{t("empieza aquí.")}</em></h1>
                <p>{t("Visualiza tus ideas antes de llevarlas al taller. Elige una moto de muestra o sube una foto y modifica cada detalle con IA.")}</p>
                <div className="hero-actions">
                  <button className="button-primary" onClick={openWorkshop}>{t("Entrar al taller")} <ArrowRight size={18} /></button>
                  <a href="#como-funciona" className="hero-secondary">{t("Descubre cómo funciona")} <ArrowDown size={16} /></a>
                </div>
                <div className="hero-proof"><div className="proof-dot"><Sparkles size={14} /></div><span><b>{t("Ediciones con IA real")}</b><br />{t("Tu foto, transformada por ti.")}</span></div>
              </div>
              <div className="hero-caption"><span className="caption-line" /> {t("INSPIRACIÓN · GARAGE NOCTURNO")} <span>01 / 04</span></div>
              <div className="hero-image-note"><Sparkles size={13} /> {t("Foto real · Unsplash")}</div>
            </section>

            <section className="trust-strip" aria-label={t("Ventajas")}>
              <div><ShieldCheck /><span><b>{t("Uso transparente de tu foto")}</b><small>{t("Foto enviada a Gemini al chatear y Stability al editar")}</small></span></div>
              <div><Gauge /><span><b>{t("Empieza en segundos")}</b><small>{t("Sin formularios obligatorios")}</small></span></div>
              <div><Sparkles /><span><b>{t("Conectores de IA reales")}</b><small>{t("Sin respuestas pregrabadas")}</small></span></div>
              <div className="trust-last"><Moon /><span><b>{t("Sin registro obligatorio")}</b><small>{t("Entra directo al taller")}</small></span></div>
            </section>

            {catalogError && <div className="inline-warning"><CircleHelp size={16} />{t(catalogError.key)}{catalogError.name ? ` ${catalogError.name}.` : ""}</div>}
            {serviceStatus && (!serviceStatus.chat_ready || !serviceStatus.image_ready) && <div className="inline-warning"><CircleHelp size={16} /><span>{t(!serviceStatus.chat_ready && !serviceStatus.image_ready ? "Configura Gemini y Stability AI para usar todas las funciones." : !serviceStatus.chat_ready ? "Configura Gemini para activar el copiloto." : "El chat está activo; configura Stability AI para editar fotos.")}</span></div>}

            <section className="models-section section-pad" id="motos">
              <div className="section-heading">
                <div><div className="eyebrow dark"><span className="eyebrow-line" /> {t("TU PRIMERA VUELTA")}</div><h2>{t("Elige tu punto de partida.")}</h2><p>{t("Prueba el taller con una foto de referencia de la moto elegida. También puedes reemplazarla por la tuya.")}</p></div>
                <div className="catalog-count"><b>08</b><span>{t("MODELOS")}<br />{t("DISPONIBLES")}</span></div>
              </div>
              <div className="filters" role="group" aria-label={t("Filtrar modelos de moto")}>
                {["Todas", "Deportiva", "Naked", "Clásica"].map(item => <button key={item} className={filter === item ? "filter-chip selected" : "filter-chip"} onClick={() => setFilter(item)}>{t(item)}</button>)}
                <span className="filter-note"><Sparkles size={14} /> {t("Foto por modelo")}</span>
              </div>
              <div className="bike-grid">
                {filteredBikes.map((item, i) => {
                  const sample = SAMPLE[item.id];
                  if (!sample) return null;
                  return <article className="bike-card" key={item.id} style={{ animationDelay: `${i * 45}ms` }}>
                    <button className="bike-photo" onClick={() => void startSample(item)} aria-label={`${t("Probar")} ${item.name} ${t("con foto de muestra")}`} style={{ backgroundImage: `url(/samples/${sample.file})` }}>
                      <span className="bike-category">{t(item.type).toUpperCase()}</span><span className="bike-card-arrow"><ArrowUpRightIcon /></span>
                    </button>
                    <div className="bike-info"><div><span className="bike-make">{t("MOTO DE REFERENCIA")}</span><h3>{item.name}</h3><p>{t(sample.detail)}</p></div><button className="bike-start" onClick={() => void startSample(item)} aria-label={`${t("Probar")} ${item.name}`}><ArrowRight size={18} /></button></div>
                  </article>;
                })}
              </div>
              <p className="sample-disclaimer"><CircleHelp size={15} /> {t("Las fotos son referencias del modelo; pueden variar el año, color o versión. La Yamaha FZ 2.0 usa una foto de FZ-S con versión no confirmada. ")}<a href="/samples/PHOTO_CREDITS.md" target="_blank" rel="noreferrer">{t("Ver créditos y licencias")}</a>.</p>
            </section>

            <section className="how-section section-pad" id="como-funciona">
              <div className="how-art" role="img" aria-label={t("Motocicleta de muestra preparada para personalización")}>
                <img src="/samples/classic.jpg" alt={t("Motocicleta café racer clásica de referencia")} loading="lazy" />
                <div className="art-tag"><span /> {t("SELECCIÓN INTELIGENTE")}</div>
                <div className="art-callout"><Sparkles size={16} /><span>{t("La IA propone la pieza")}<br /><b>{t("tú guías el cambio")}</b></span></div>
              </div>
              <div className="how-copy">
                <div className="eyebrow dark"><span className="eyebrow-line" /> {t("FÁCIL, VISUAL, TUYO")}</div><h2>{t("De la idea a la imagen.")}<br /><em>{t("Así de sencillo.")}</em></h2>
                <div className="steps">
                  <div className="step"><span className="step-number">01</span><div><h3>{t("Elige o sube")}</h3><p>{t("Empieza con una moto de referencia o una foto lateral de la tuya.")}</p></div></div>
                  <div className="step"><span className="step-number">02</span><div><h3>{t("Cuéntale a Gemini")}</h3><p>{t("Describe tu idea con tus palabras. La IA concreta la pieza y el estilo.")}</p></div></div>
                  <div className="step"><span className="step-number">03</span><div><h3>{t("Pinta y transforma")}</h3><p>{t("Marca la zona de la pieza y aplica una edición real con Stability AI.")}</p></div></div>
                </div>
                <button className="text-link" onClick={openWorkshop}>{t("Empezar a explorar")} <ArrowRight size={16} /></button>
              </div>
            </section>

            <section className="cta-band">
              <div className="cta-glow" /><div className="eyebrow"><span className="eyebrow-line" /> {t("GARAGE ABIERTO")}</div>
              <h2>{t("Tu idea merece")}<br />{t("verse ")}<em>{t("en grande.")}</em></h2>
              <p>{t("No necesitas cuenta para probar. Solo una idea y ganas de experimentar.")}</p>
              <button className="button-primary" onClick={openWorkshop}>{t("Entrar al taller")} <ArrowRight size={18} /></button>
              <div className="cta-stamp">M<br /><span>·</span></div>
            </section>

            <section className="faq-section section-pad" id="preguntas">
              <div className="faq-intro"><div className="eyebrow dark"><span className="eyebrow-line" /> {t("ANTES DE ARRANCAR")}</div><h2>{t("Preguntas rápidas.")}</h2><p>{t("Lo esencial para entrar al taller con confianza.")}</p></div>
              <div className="faq-list">
                <details><summary>{t("¿Necesito crear una cuenta para probar?")} <ChevronDown size={18} /></summary><p>{t("No. Puedes elegir un modelo y comenzar en el momento. La cuenta es opcional y sirve para identificar tu sesión en este dispositivo.")}</p></details>
                <details><summary>{t("¿Las modificaciones son imágenes reales?")} <ChevronDown size={18} /></summary><p>{t("El chat consulta Gemini y las modificaciones se generan con Stability AI. Tú pintas la zona que quieres cambiar y esa máscara guía el inpainting.")}</p></details>
                <details><summary>{t("¿Puedo usar mi propia moto y mi foto?")} <ChevronDown size={18} /></summary><p>{t("Sí. Entra a “Taller virtual”, escribe el nombre de tu moto y sube una foto JPG, PNG o WebP. También puedes cambiar la foto dentro del taller. Una vista lateral bien iluminada ayuda a marcar las piezas. La imagen se envía a Gemini para analizar la moto y a Stability AI al generar el cambio; MotoMod no la publica ni la guarda en tu cuenta. Si guardas el proyecto en Mi garaje, queda en este dispositivo.")}</p></details>
              </div>
            </section>
          </main>

          <footer className="site-footer"><a className="brand footer-brand" href="#inicio"><MotoMark /><span className="brand-word">MOTOMOD<small>{t("TALLER DIGITAL")}</small></span></a><span>{t("Diseñado para imaginar lo que viene.")}</span><div><button onClick={openGarage}>{t("Mi garaje")}</button><a href="#como-funciona">{t("Cómo funciona")}</a><button onClick={() => { setAuthMode("signup"); setAuthOpen(true); }}>{t("Crear cuenta")}</button><a href="#preguntas">{t("Ayuda")}</a></div><small>© 2026 MotoMod · {t("Proyecto académico")}</small></footer>
        </>
      ) : screen === "workshop" || !bike ? (
        <main className="workshop-page">
          <header className="studio-header workshop-header">
            <button className="studio-back" onClick={goHome}><ArrowLeft size={17} /><span>{t("Volver a MotoMod")}</span></button>
            <a className="brand studio-brand" href="#" onClick={e => { e.preventDefault(); goHome(); }}><MotoMark /><span className="brand-word">MOTOMOD<small>{t("TALLER DIGITAL")}</small></span></a>
            <div className="studio-menu"><PreferencesMenu locale={locale} setLocale={setLocale} t={t} theme={theme} setTheme={setTheme} largeText={largeText} setLargeText={setLargeText} highContrast={highContrast} setHighContrast={setHighContrast} reducedMotion={reducedMotion} setReducedMotion={setReducedMotion} /><button className="studio-account" onClick={openGarage}><FolderOpen size={16} />{t("Mi garaje")}</button><button className="studio-account" onClick={() => user ? setAccountView(true) : (setAuthMode("signup"), setAuthOpen(true))}>{user ? <UserRound size={16} /> : <LogIn size={16} />}{user ? t("Mi perfil") : t("Crear cuenta")}</button></div>
          </header>
          <section className="workshop-intro">
            <div className="eyebrow dark"><span className="eyebrow-line" /> {t("TALLER VIRTUAL · TU ESPACIO DE DISEÑO")}</div>
            <h1>{t("Empieza con ")}<em>{t("tu moto.")}</em></h1>
            <p>{t("Elige una referencia del catálogo o sube una foto de cualquier vehículo. La experiencia de edición comienza en la siguiente pantalla.")}</p>
          </section>
          {error && <div className="inline-warning workshop-warning" role="alert"><CircleHelp size={16} />{error}</div>}
          <div className="workshop-choices">
            <section className="workshop-samples">
              <div className="workshop-heading"><div className="eyebrow dark"><span className="eyebrow-line" /> {t("OPCIÓN 01")}</div><h2>{t("Usa una referencia")}</h2><p>{t("Escoge una de las motos disponibles para iniciar con una foto de muestra.")}</p></div>
              <div className="workshop-bike-grid">
                {bikes.map(item => {
                  const sample = SAMPLE[item.id];
                  if (!sample) return null;
                  return <button className="workshop-bike" key={item.id} onClick={() => void startSample(item)}>
                    <span className="workshop-bike-image" style={{ backgroundImage: `url(/samples/${sample.file})` }} />
                    <span className="workshop-bike-copy"><small>{t(item.type).toUpperCase()} · {t("REFERENCIA")}</small><b>{item.name}</b></span>
                    <ArrowRight size={17} />
                  </button>;
                })}
              </div>
              <p className="workshop-note"><CircleHelp size={15} /> {t("Las fotos representan una categoría, no siempre el año o color exacto. Puedes reemplazar la imagen en el taller.")}</p>
            </section>
            <section className="custom-bike-card">
              <div className="eyebrow dark"><span className="eyebrow-line" /> {t("OPCIÓN 02 · TU VEHÍCULO")}</div>
              <div className="custom-bike-icon"><ImagePlus size={22} /></div>
              <h2>{t("Trae tu propia moto.")}</h2>
              <p>{t("Escribe cómo la identificas y sube una foto para personalizar exactamente tu vehículo.")}</p>
              <label className="workshop-field">{t("Marca y modelo")}<input value={ownVehicleName} onChange={e => setOwnVehicleName(e.target.value)} placeholder={t("Ej. Honda CB190R")} maxLength={80} /></label>
              <label className="workshop-field">{t("Estilo")}<select value={ownVehicleType} onChange={e => setOwnVehicleType(e.target.value)}>{["Otra", "Deportiva", "Naked", "Clásica", "Adventure", "Scooter", "Custom"].map(type => <option key={type} value={type}>{t(type)}</option>)}</select></label>
              <input ref={ownPhotoInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => selectOwnPhoto(e.target.files?.[0])} />
              <button className={ownPhoto ? "photo-picker has-photo" : "photo-picker"} onClick={() => ownPhotoInput.current?.click()}><ImagePlus size={17} /><span><b>{ownPhoto ? ownPhoto.name : t("Sube una foto de tu moto")}</b><small>JPG, PNG {t("o")} WebP</small></span><ChevronRight size={17} /></button>
              {ownPhoto && ownPhotoUrl && <div className="own-photo-preview"><img src={ownPhotoUrl} alt={t("Vista previa de la foto seleccionada")} /><span>{t("Foto lista para el taller")}</span><button onClick={() => { selectOwnPhoto(); if (ownPhotoInput.current) ownPhotoInput.current.value = ""; }}>{t("Quitar")}</button></div>}
              <button className="button-primary own-bike-submit" onClick={startOwnVehicle} disabled={!ownVehicleName.trim() || !ownPhoto}>{t("Abrir mi taller")} <ArrowRight size={17} /></button>
              <small className="photo-privacy"><ShieldCheck size={14} /> {t("La foto se envía a Gemini con cada mensaje como referencia; Stability AI la recibe al generar un cambio.")}</small>
            </section>
          </div>
        </main>
      ) : (
        <main className="studio-page">
          <header className="studio-header">
            <button className="studio-back" onClick={goHome}><ArrowLeft size={17} /><span>{t("Salir del taller")}</span></button>
            <a className="brand studio-brand" href="#inicio" onClick={e => { e.preventDefault(); goHome(); }}><MotoMark /><span className="brand-word">MOTOMOD<small>{t("TALLER DIGITAL")}</small></span></a>
            <div className="studio-menu"><span className="studio-bike-name">{bike?.name}</span><PreferencesMenu locale={locale} setLocale={setLocale} t={t} theme={theme} setTheme={setTheme} largeText={largeText} setLargeText={setLargeText} highContrast={highContrast} setHighContrast={setHighContrast} reducedMotion={reducedMotion} setReducedMotion={setReducedMotion} /><button className="studio-account" onClick={openGarage}><FolderOpen size={16} />{t("Mi garaje")}</button><button className="studio-account" onClick={() => user ? setAccountView(true) : (setAuthMode("signup"), setAuthOpen(true))}>{user ? <UserRound size={16} /> : <LogIn size={16} />}{user ? t("Mi perfil") : t("Crear cuenta")}</button></div>
          </header>
          <div className="studio-layout">
            <section className="studio-workspace">
              <div className="studio-toolbar"><div><span className="studio-kicker">{t("ESPACIO DE DISEÑO")}</span><h1>{bike?.name}</h1></div><div className="toolbar-controls"><button disabled={at === 0 || !!busy} onClick={() => { setAt(at - 1); setPending(null); }}><RotateCcw size={15} />{t("Deshacer")}</button><button disabled={at >= versions.length - 1 || !!busy} onClick={() => { setAt(at + 1); setPending(null); }}>{t("Rehacer")}</button><button disabled={at === 0} onClick={() => setCompare(v => !v)}><Eye size={15} />{t(compare ? "Vista única" : "Comparar")}</button><a className="tool-download" href={current?.url} download="mi-moto-modificada.png"><Download size={15} />{t("Guardar")}</a></div></div>
              <div className="canvas-wrap">
                {current && <>
                  {pending && <div className="selection-hint"><Sparkles size={15} />{strokes.length ? `${t("Zona marcada para")} ${pending.part}. ${t("Puedes seguir pintando para cubrirla mejor.")}` : `${t("Pinta la pieza que quieres cambiar:")} ${pending.part}. ${t("Marca también dónde debe ir la pieza nueva. Cada edición consume 5 créditos de Stability AI.")}`}</div>}
                  <div className={`canvas${pending ? " is-selecting" : ""}`}>
                    <div className="canvas-image-frame">
                      <img ref={canvasImage} className="canvas-main" src={current.url} onLoad={event => setImageDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} alt={`${bike?.name}, ${t(current.label)}`} draggable={false} />
                      {pending && imageDimensions && <svg className="paint-overlay" viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`} preserveAspectRatio="none" aria-label={`${t("Pinta la zona de")} ${pending.part}`} onPointerDown={startPainting} onPointerMove={continuePainting} onPointerUp={finishPainting} onPointerCancel={finishPainting}>
                        {strokes.map((stroke, i) => {
                          const first = stroke.points[0];
                          const path = stroke.points.map((point, j) => `${j === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
                          return stroke.points.length === 1 && first
                            ? <circle key={i} cx={first.x} cy={first.y} r={stroke.width / 2} fill="rgba(237,174,48,.58)" />
                            : <path key={i} d={path} fill="none" stroke="rgba(237,174,48,.58)" strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />;
                        })}
                      </svg>}
                    </div>
                    {compare && at > 0 && <><img className="compare-before" src={versions[0].url} alt={t("Vista anterior")} style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} /><span className="compare-label before-label">{t("ANTES")}</span><span className="compare-label after-label">{t("AHORA")}</span><input className="compare-slider" type="range" min="0" max="100" value={split} onChange={e => setSplit(Number(e.target.value))} aria-label={t("Desliza para comparar antes y después")} /></>}
                    {busy && <div className="canvas-progress"><span className="spinner" />{busy}</div>}
                  </div>
                  {pending && <div className="selection-tools"><label htmlFor="brush-size">{t("Tamaño del pincel")} <b>{brushSize}px</b></label><input id="brush-size" type="range" min="18" max="90" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} aria-label={t("Tamaño del pincel de selección")} /><button onClick={() => setStrokes([])} disabled={!strokes.length || !!busy}>{t("Limpiar selección")}</button></div>}
                  {strokes.length > 0 && <div className="mask-confirm"><span><Check size={15} /> {t("Zona marcada")}</span><button onClick={() => setStrokes([])} disabled={!!busy}>{t("Empezar de nuevo")}</button><button className="confirm-button" onClick={applyEdit} disabled={!!busy}>{t("Aplicar cambio")} <ArrowRight size={15} /></button></div>}
                  <div className="version-strip" aria-label={t("Historial de imágenes")}>{versions.map((version, i) => <button key={`${version.label}-${i}`} className={i === at ? "version-card active" : "version-card"} disabled={!!busy} onClick={() => { setAt(i); setPending(null); }}><img src={version.url} alt="" /><span><b>{t(version.label)}</b><small>{i === 0 ? t("Original") : `${t("Versión ")}${i + 1}`}</small></span></button>)}</div>
                  <div className="canvas-footnote"><span><ShieldCheck size={14} />{t("Gemini analiza la foto; Stability AI la recibe al editar")}</span><span>{t(current.label === "Foto de muestra" ? currentSample?.studioNote || "Foto de muestra" : current.label === "Mi foto" ? "Foto original de tu vehículo" : "Versión editada")}</span></div>
                </>}
              </div>
            </section>
            <aside className="chat-panel">
              <div className="chat-heading"><div className="chat-avatar"><Sparkles size={17} /></div><div><b>{t("Copiloto de diseño")}</b><span className={serviceStatus?.chat_ready ? "provider-ready" : "provider-offline"}><i />{serviceStatus?.chat_ready ? t("Gemini · API real activa") : t("Gemini · falta configurar API")}</span></div><button onClick={() => { setMsgs([{ role: "assistant", content: t(GREETING) }]); setSuggestions(pickIdeas(locale)); setPending(null); setError(""); }} title={t("Nueva conversación")}><MoreHorizontal size={19} /></button></div>
              <div className="chat-context"><MessageCircle size={14} /><span>{t("Diseñando para")} <b>{bike?.name}</b></span></div>
              {serviceStatus && (!serviceStatus.chat_ready || !serviceStatus.image_ready) && <div className="service-warning"><CircleHelp size={14} /><span>{!serviceStatus.chat_ready && !serviceStatus.image_ready ? t("Faltan GEMINI_API_KEY para el chat y STABILITY_API_KEY para editar fotos.") : !serviceStatus.chat_ready ? t("Falta GEMINI_API_KEY para activar el chat real.") : t("El chat está activo. Configura STABILITY_API_KEY para editar fotos.")}</span></div>}
              <div className="chat-messages" aria-live="polite">
                {msgs.map((message, i) => <div key={i} className={`chat-bubble ${message.role}`}><p>{message.content}</p>{message.role === "assistant" && i > 0 && <small><Sparkles size={11} /> Gemini</small>}</div>)}
                {busy && <div className="chat-bubble assistant"><div className="typing-dots"><i /><i /><i /></div><small>{busy}</small></div>}
                <div ref={chatEnd} />
              </div>
              {error && <div className="chat-error" role="alert"><CircleHelp size={16} /><span>{error}</span></div>}
              {msgs.length <= 1 && <div className="prompt-suggestions"><span>{t("IDEAS PARA EMPEZAR · ALEATORIAS")}</span>{suggestions.map(idea => <button key={idea} onClick={() => void send(idea)} disabled={!!busy}>{idea}<ArrowUpRightIcon /></button>)}<button className="refresh-suggestions" onClick={() => setSuggestions(pickIdeas(locale))} disabled={!!busy}>{t("Ver otras ideas")} <RotateCcw size={13} /></button></div>}
              {pending && !busy && !strokes.length && <div className="part-prompt"><Sparkles size={15} /><span>{t("Gemini sugiere modificar")} <b>{pending.part}</b>. {t("Pinta la zona de esa pieza y el área donde quieres que aparezca el cambio.")}</span></div>}
              {pending && !busy && <button className="cancel-edit" onClick={() => { setPending(null); setStrokes([]); }}>{t("Cancelar selección")}</button>}
              <div className="chat-compose"><textarea value={text} rows={2} disabled={!!busy} placeholder={t("Describe tu idea…")} aria-label={t("Describe la modificación")} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }} /><button className="send-button" onClick={() => void send(text)} disabled={!!busy || !text.trim()} aria-label={t("Enviar mensaje")}><ArrowRight size={18} /></button><small>{t("Enter para enviar · Shift + Enter para una nueva línea")}</small></div>
            </aside>
          </div>
          <div className="studio-bottom-bar"><span><Sparkles size={14} /> {t("Tu imaginación conduce.")}</span><button onClick={() => fileInput.current?.click()}><ImagePlus size={15} />{t("Subir mi foto")}</button><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => loadPhoto(e.target.files?.[0])} /><button onClick={openWorkshop}>{t("Cambiar de moto")} <ChevronRight size={15} /></button></div>
        </main>
      )}

      {(authOpen || accountView) && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setAuthOpen(false); setAccountView(false); } }}>
        <section ref={accountModal} className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title">
          <button className="modal-close" onClick={() => { setAuthOpen(false); setAccountView(false); }} aria-label={t("Cerrar")}><X size={19} /></button>
          {accountView && user ? <>
            <div className="account-icon"><UserRound size={21} /></div><div className="eyebrow dark"><span className="eyebrow-line" /> {t("MI PERFIL")}</div><h2 id="account-title">{t("Hola, ")}{user.name.split(" ")[0]}.</h2><p className="account-copy">{t("Tu perfil de MotoMod. Puedes seguir usando el taller en este dispositivo.")}</p>
            <div className="account-details"><span>{t("Nombre")}</span><b>{user.name}</b><span>{t("Correo electrónico")}</span><b>{user.email}</b><span>{t("Cuenta creada")}</span><b>{t("Sesión protegida")}</b></div>
            <div className="account-note"><CircleHelp size={15} />{t("Las fotos e historial actuales permanecen en esta sesión; todavía no se guardan en la nube.")}</div>
            <button className="account-submit signout" onClick={() => void signOut()}><LogOut size={16} />{t("Cerrar sesión")}</button>
          </> : <>
            <div className="account-icon"><Sparkles size={21} /></div><div className="eyebrow dark"><span className="eyebrow-line" /> {t(authMode === "signup" ? "BIENVENIDO AL GARAJE" : "QUÉ BUENO VERTE")}</div>
            <h2 id="account-title">{t(authMode === "signup" ? "Crea tu cuenta." : "Entra a tu cuenta.")}</h2>
            <p className="account-copy">{t(authMode === "signup" ? "Guarda tu perfil en este dispositivo y vuelve al taller cuando quieras." : "Inicia sesión para identificar tu perfil en este dispositivo.")}</p>
            <form className="account-form" onSubmit={submitAuth}>
              {authMode === "signup" && <label>{t("Nombre")}<input name="name" autoComplete="name" required minLength={2} maxLength={60} placeholder={t("Cómo te llamamos")} /></label>}
              <label>{t("Correo electrónico")}<input name="email" type="email" autoComplete="email" required placeholder={t("tu@correo.com")} /></label>
              <div className="account-field"><label htmlFor="account-password">{t("Contraseña")}</label><span className="password-wrap"><input id="account-password" name="password" type={showPassword ? "text" : "password"} autoComplete={authMode === "signup" ? "new-password" : "current-password"} required minLength={authMode === "signup" ? 10 : 1} placeholder={t(authMode === "signup" ? "Mínimo 10 caracteres" : "Tu contraseña")} /><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={t(showPassword ? "Ocultar contraseña" : "Mostrar contraseña")}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></div>
              {authError && <p className="auth-error" role="alert">{authError}</p>}
              <button className="account-submit" type="submit" disabled={authBusy}>{authBusy ? t("Un momento…") : t(authMode === "signup" ? "Crear cuenta" : "Iniciar sesión")}<ArrowRight size={17} /></button>
            </form>
            <p className="account-switch">{t(authMode === "signup" ? "¿Ya tienes cuenta?" : "¿Primera vez por aquí?")} <button onClick={() => { setAuthMode(authMode === "signup" ? "login" : "signup"); setAuthError(""); }}>{t(authMode === "signup" ? "Inicia sesión" : "Crea una cuenta")}</button></p>
            <p className="account-optional">{t("Crear cuenta es opcional. Puedes seguir probando sin registrarte.")}</p>
          </>}
        </section>
      </div>}
    </div>
  );
}

function ArrowUpRightIcon() { return <ArrowRight size={15} className="arrow-up-right" aria-hidden="true" />; }

function GarageCard({ entry, locale, t, onOpen, onDelete }: { entry: GarageEntry; locale: Locale; t: (key: string) => string; onOpen: () => void; onDelete: () => void }) {
  const [previewUrl, setPreviewUrl] = useState("");
  const latest = entry.versions[entry.versions.length - 1];
  useEffect(() => {
    if (!latest) return;
    const url = URL.createObjectURL(latest.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [latest]);
  const changes = entry.versions.slice(1).map(version => version.label);
  const modifiedAt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(entry.updatedAt);
  return <article className="garage-card">
    <button className="garage-card-preview" onClick={onOpen} aria-label={`${t("Abrir proyecto de")} ${entry.bikeName}`}>
      {previewUrl && <img src={previewUrl} alt={`${entry.bikeName} · ${t("última modificación")}`} />}
      <span>{changes.length ? t("ÚLTIMA MODIFICACIÓN") : t("FOTO ORIGINAL")}</span>
    </button>
    <div className="garage-card-content">
      <div className="garage-card-heading"><div><small>{t(entry.bikeType).toUpperCase()}</small><h2>{entry.bikeName}</h2></div><button className="garage-delete" onClick={onDelete} aria-label={`${t("Eliminar proyecto de")} ${entry.bikeName}`} title={t("Eliminar del garaje")}><Trash2 size={17} /></button></div>
      <p className="garage-card-date">{t("Último cambio")}: {modifiedAt}</p>
      <div className="garage-changes"><b>{t("MODIFICACIONES")} · {changes.length}</b>{changes.length ? <ul>{changes.map((change, index) => <li key={`${index}-${change}`}>{t(change)}</li>)}</ul> : <span>{t("Aún no tiene cambios guardados.")}</span>}</div>
      <button className="garage-open-button" onClick={onOpen}>{t("Continuar editando")} <ArrowRight size={16} /></button>
    </div>
  </article>;
}

type PreferencesMenuProps = {
  locale: Locale;
  setLocale: (value: Locale) => void;
  t: (key: string) => string;
  theme: "light" | "dark";
  setTheme: (value: "light" | "dark") => void;
  largeText: boolean;
  setLargeText: (value: boolean) => void;
  highContrast: boolean;
  setHighContrast: (value: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (value: boolean) => void;
};

function PreferencesMenu(props: PreferencesMenuProps) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className="preferences" ref={menu}>
    <button className="preferences-trigger" aria-label={props.t("Abrir preferencias")} aria-expanded={open} aria-controls="preferences-panel" onClick={() => setOpen(value => !value)}><Settings2 size={17} /><span>{props.t("Opciones")}</span></button>
    {open && <section className="preferences-panel" id="preferences-panel" aria-label={props.t("Preferencias de apariencia y accesibilidad")}>
      <div className="preferences-title"><Accessibility size={17} /><b>{props.t("Preferencias")}</b></div>
      <label className="preferences-language"><span><Languages size={15} />{props.t("Idioma")}</span><select aria-label={props.t("Idioma de la interfaz")} value={props.locale} onChange={event => props.setLocale(event.target.value as Locale)}>{(Object.keys(localeNames) as Locale[]).map(code => <option key={code} value={code}>{localeNames[code]}</option>)}</select></label>
      <div className="preferences-section"><span className="preferences-label">{props.t("Apariencia")}</span><div className="theme-options" role="group" aria-label={props.t("Tema de color")}><button aria-pressed={props.theme === "light"} onClick={() => props.setTheme("light")}><Sun size={15} />{props.t("Claro")}</button><button aria-pressed={props.theme === "dark"} onClick={() => props.setTheme("dark")}><Moon size={15} />{props.t("Oscuro")}</button></div></div>
      <div className="preferences-section"><span className="preferences-label">{props.t("Accesibilidad")}</span>
        <label className="preferences-toggle"><span><Type size={15} />{props.t("Texto grande")}</span><input type="checkbox" checked={props.largeText} onChange={event => props.setLargeText(event.target.checked)} /></label>
        <label className="preferences-toggle"><span><Contrast size={15} />{props.t("Alto contraste")}</span><input type="checkbox" checked={props.highContrast} onChange={event => props.setHighContrast(event.target.checked)} /></label>
        <label className="preferences-toggle"><span><Accessibility size={15} />{props.t("Reducir movimiento")}</span><input type="checkbox" checked={props.reducedMotion} onChange={event => props.setReducedMotion(event.target.checked)} /></label>
      </div>
    </section>}
  </div>;
}

function MotoMark() {
  return <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 40"><path d="M20.7 1.5 4.4 22.1h10.1L11.8 38.5l16-22.2H17.5z" /></svg></span>;
}
