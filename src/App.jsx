import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, LayoutGrid, TrendingUp, TrendingDown, PiggyBank, ChevronLeft, ChevronRight, Plus, Trash2, ChevronDown, CreditCard, RefreshCw, ArrowUpRight, ArrowDownRight, Wallet, Landmark, Coins, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';

// ═══════════════════════════════════════════════════════════════════════════
//  SUPABASE — los valores vienen de variables de entorno.
//  En local: archivo .env      En Vercel: Settings → Environment Variables
// ═══════════════════════════════════════════════════════════════════════════
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Ojo: la base va SIN RLS, así que esta key sola alcanza para leer y escribir
// todo. Las variables de entorno NO la esconden (Vite la compila dentro del
// bundle); solo evitan que quede escrita en el repositorio.

async function sb(path, { method = 'GET', body, query } = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}${query ? '?' + query : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detalle = await res.json().catch(() => ({}));
    throw new Error(detalle.message || `Error ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// ─── Traducción entre la forma de la DB (snake_case) y la de la app ────────
const mapa = {
  categorias: {
    tabla: 'categorias',
    aApp: (r) => ({ id: r.id, nombre: r.nombre, icono: r.icono, especial: r.especial || undefined, predeterminada: r.predeterminada }),
    aDB: (r) => ({ nombre: r.nombre, icono: r.icono, especial: r.especial ?? null, predeterminada: false }),
  },
  ingresos: {
    tabla: 'ingresos',
    aApp: (r) => ({ id: r.id, tipo: r.tipo, nombre: r.nombre, monto: Number(r.monto), moneda: r.moneda, anual: r.anual, mes: r.mes, anio: r.anio }),
    aDB: (r) => ({ tipo: r.tipo, nombre: r.nombre, monto: r.monto, moneda: r.moneda, anual: r.anual, mes: r.mes, anio: r.anio }),
  },
  egresos: {
    tabla: 'egresos',
    aApp: (r) => ({ id: r.id, catId: r.cat_id, nombre: r.nombre, monto: Number(r.monto), moneda: r.moneda, anual: r.anual, mes: r.mes, anio: r.anio }),
    aDB: (r) => ({ cat_id: r.catId, nombre: r.nombre, monto: r.monto, moneda: r.moneda, anual: r.anual, mes: r.mes, anio: r.anio }),
  },
  tarjeta: {
    tabla: 'tarjeta_gastos',
    aApp: (r) => ({ id: r.id, nombre: r.nombre, total: Number(r.total), moneda: r.moneda, cuotas: r.cuotas, desdeMes: r.desde_mes, desdeAnio: r.desde_anio }),
    aDB: (r) => ({ nombre: r.nombre, total: r.total, moneda: r.moneda, cuotas: r.cuotas, desde_mes: r.desdeMes, desde_anio: r.desdeAnio }),
  },
  ahorros: {
    tabla: 'ahorros',
    aApp: (r) => ({ id: r.id, clase: r.clase, nombre: r.nombre, monto: Number(r.monto), moneda: r.moneda, tna: r.tna == null ? null : Number(r.tna) }),
    aDB: (r) => ({ clase: r.clase, nombre: r.nombre ?? null, monto: r.monto, moneda: r.moneda, tna: r.tna ?? null }),
  },
};

// ─── Datos ─────────────────────────────────────────────────────────────────
function useFinanzas() {
  const [datos, setDatos] = useState({ categorias: [], ingresos: [], egresos: [], tarjeta: [], ahorros: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const claves = Object.keys(mapa);
      const respuestas = await Promise.all(
        claves.map((k) => sb(mapa[k].tabla, { query: 'select=*&order=creado_en.desc' }))
      );
      const next = {};
      claves.forEach((k, i) => { next[k] = respuestas[i].map(mapa[k].aApp); });
      next.categorias.reverse(); // las categorías se muestran en el orden en que se crearon
      setDatos(next);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const agregar = useCallback(async (clave, fila) => {
    const { tabla, aDB, aApp } = mapa[clave];
    setError(null);
    try {
      const [creada] = await sb(tabla, { method: 'POST', body: aDB(fila) });
      const item = aApp(creada);
      setDatos((d) => ({ ...d, [clave]: clave === 'categorias' ? [...d[clave], item] : [item, ...d[clave]] }));
      return item;
    } catch (e) {
      setError(`No se pudo guardar: ${e.message}`);
      return null;
    }
  }, []);

  const editar = useCallback(async (clave, id, fila) => {
    const { tabla, aDB, aApp } = mapa[clave];
    setError(null);
    try {
      const [actualizada] = await sb(tabla, { method: 'PATCH', query: `id=eq.${id}`, body: aDB(fila) });
      const item = aApp(actualizada);
      setDatos((d) => ({ ...d, [clave]: d[clave].map((x) => (x.id === id ? item : x)) }));
      return item;
    } catch (e) {
      setError(`No se pudo guardar el cambio: ${e.message}`);
      return null;
    }
  }, []);

  const borrar = useCallback(async (clave, id) => {
    const { tabla } = mapa[clave];
    setError(null);
    setDatos((d) => {
      const next = { ...d, [clave]: d[clave].filter((x) => x.id !== id) };
      if (clave === 'categorias') next.egresos = d.egresos.filter((e) => e.catId !== id); // la DB borra en cascada
      return next;
    });
    try {
      await sb(tabla, { method: 'DELETE', query: `id=eq.${id}` });
    } catch (e) {
      setError(`No se pudo borrar: ${e.message}`);
      cargar(); // volvemos a leer la verdad de la base
    }
  }, [cargar]);

  return { ...datos, cargando, error, agregar, editar, borrar, recargar: cargar, limpiarError: () => setError(null) };
}

// ─── Estado de la conexión con Supabase ────────────────────────────────────
// Lee una fila de `categorias` y traduce lo que pasa a algo accionable.
function useConexion() {
  const [estado, setEstado] = useState({ status: 'verificando', ms: null, detalle: null });

  const probar = useCallback(async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setEstado({ status: 'error', ms: null, detalle: 'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY' });
      return;
    }
    setEstado((e) => ({ ...e, status: 'verificando' }));
    const t0 = performance.now();
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/categorias?select=id&limit=1`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      });
      const ms = Math.round(performance.now() - t0);

      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({}));
        const porCodigo = {
          401: 'La anon key no es válida',
          403: 'Sin permisos: ¿quedó la RLS activa?',
          404: 'No existe la tabla: ¿corriste schema.sql?',
        };
        setEstado({ status: 'error', ms, detalle: porCodigo[res.status] || cuerpo.message || `Error ${res.status}` });
        return;
      }

      // Con RLS activa y sin policies, Postgres devuelve 200 y una lista vacía.
      // O sea: "conectado" pero sin ver nada. Hay que distinguirlo.
      const filas = await res.json();
      if (!Array.isArray(filas) || filas.length === 0) {
        setEstado({ status: 'aviso', ms, detalle: 'Conecta, pero no hay categorías: ¿RLS activa o falta correr schema.sql?' });
        return;
      }

      setEstado({ status: 'ok', ms, detalle: null });
    } catch {
      setEstado({ status: 'error', ms: null, detalle: 'No se llega al servidor: revisá la URL o la red' });
    }
  }, []);

  useEffect(() => { probar(); }, [probar]);
  return { ...estado, probar };
}

// ═══════════════════════════════════════════════════════════════════════════

const C = {
  bg: '#0B0F14',
  card: '#141B24',
  border: '#232D3A',
  text: '#F1F5F4',
  textDim: '#B8C4C2',
  textMute: '#7C8B89',
  mint: '#2FBF71',
  mintSoft: 'rgba(47,191,113,0.12)',
  mintBorder: 'rgba(47,191,113,0.25)',
  coral: '#F0475F',
  coralSoft: 'rgba(240,71,95,0.12)',
  coralBorder: 'rgba(240,71,95,0.25)',
  gold: '#E0A93B',
  goldSoft: 'rgba(224,169,59,0.12)',
  goldBorder: 'rgba(224,169,59,0.25)',
};

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO = ['E','F','M','A','M','J','J','A','S','O','N','D'];
const PIE_COLORS = ['#2FBF71', '#5EA8FF', '#E0A93B', '#F0475F', '#A78BFA', '#38BDF8', '#F97316'];

const DOLAR_FALLBACK = 1510;

function fmt(n) { return Math.round(n).toLocaleString('es-AR'); }

// Acepta lo que escribe la gente de verdad: "1.400.000", "1400000", "1.400,50",
// "1400.50". Devuelve NaN si no hay un número adentro.
function parseMonto(v) {
  if (typeof v === 'number') return v;
  if (!v) return NaN;
  let s = String(v).trim().replace(/\s/g, '').replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return NaN;   // no quedó ningún dígito: "abc", "$$$", etc.
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');   // coma = decimal, puntos = miles
  } else {
    const partes = s.split('.');
    // "1.400.000" o "1.400" → puntos de miles.  "1400.50" → punto decimal.
    if (partes.length > 2 || (partes.length === 2 && partes[1].length === 3)) s = partes.join('');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
function toARS(monto, moneda, dolar) {
  const n = Number(monto) || 0;
  return moneda === 'USD' ? n * dolar : n;
}

function useDolar() {
  const [estado, setEstado] = useState({ valor: DOLAR_FALLBACK, fecha: null, status: 'cargando' });
  const cargar = useCallback(async () => {
    setEstado((e) => ({ ...e, status: 'cargando' }));
    try {
      const res = await fetch('https://dolarapi.com/v1/dolares/oficial');
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (typeof data.venta !== 'number') throw new Error();
      setEstado({ valor: data.venta, fecha: data.fechaActualizacion, status: 'ok' });
    } catch {
      setEstado({ valor: DOLAR_FALLBACK, fecha: null, status: 'error' });
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  return { ...estado, recargar: cargar };
}

const btnGhost = { background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', padding: 6, display: 'flex' };
const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 };
const input = { background: '#1A222D', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' };
// El marco (ancho, alto, borde) vive en .app-frame dentro de index.html:
// tiene que ser CSS y no estilo inline, porque necesita una media query.

export default function App() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return <FaltanClaves />;
  return <Finanzas />;
}

function FaltanClaves() {
  return (
    <div className="app-frame" style={{ justifyContent: 'center', padding: 28, boxSizing: 'border-box', textAlign: 'center' }}>
      <AlertCircle size={28} color={C.gold} style={{ margin: '0 auto 12px' }} />
      <h1 style={{ fontSize: 18, margin: '0 0 8px', fontWeight: 600 }}>Faltan las claves de Supabase</h1>
      <p style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.6, margin: 0 }}>
        Definí <code style={{ color: C.mint }}>VITE_SUPABASE_URL</code> y{' '}
        <code style={{ color: C.mint }}>VITE_SUPABASE_ANON_KEY</code> en el archivo{' '}
        <code style={{ color: C.mint }}>.env</code> (local) o en las variables de entorno de Vercel.
      </p>
    </div>
  );
}

function Finanzas() {
  const [tab, setTab] = useState('dashboard');
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const fin = useFinanzas();
  const dolar = useDolar();
  const conexion = useConexion();

  const shiftMonth = (d) => {
    let m = mes + d, y = anio;
    if (m < 1) { m = 12; y -= 1; } if (m > 12) { m = 1; y += 1; }
    setMes(m); setAnio(y);
  };

  return (
    <div className="app-frame">
      <Header tab={tab} mes={mes} anio={anio} shiftMonth={shiftMonth} conexion={conexion} />

      {fin.error && (
        <div style={{ background: C.coralSoft, borderBottom: `1px solid ${C.coralBorder}`, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.coral }}>
          <AlertCircle size={14} /><span style={{ flex: 1 }}>{fin.error}</span>
          <button onClick={fin.limpiarError} style={{ ...btnGhost, padding: 0, color: C.coral }}>✕</button>
        </div>
      )}

      <div style={{ flex: 1, padding: '16px 18px', paddingBottom: 'calc(100px + env(safe-area-inset-bottom))', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {fin.cargando ? (
          <p style={{ color: C.textMute, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>Trayendo tus datos…</p>
        ) : (
          <>
            {tab === 'dashboard' && <Dashboard mes={mes} anio={anio} fin={fin} dolar={dolar} />}
            {tab === 'ingresos' && <Ingresos mes={mes} anio={anio} fin={fin} dolar={dolar.valor} />}
            {tab === 'egresos' && <Egresos mes={mes} anio={anio} fin={fin} dolar={dolar.valor} />}
            {tab === 'ahorros' && <Ahorros fin={fin} dolar={dolar.valor} />}
          </>
        )}
      </div>

      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

function Header({ tab, mes, anio, shiftMonth, conexion }) {
  const titles = { dashboard: 'Resumen', ingresos: 'Ingresos', egresos: 'Egresos', ahorros: 'Ahorros' };
  return (
    <div style={{ padding: '16px 18px 12px', paddingTop: 'calc(16px + env(safe-area-inset-top))', borderBottom: `1px solid ${C.border}`, background: 'rgba(11,15,20,0.9)' }}>
      <p style={{ fontSize: 11, letterSpacing: '0.2em', color: C.mint, textTransform: 'uppercase', margin: 0, fontFamily: 'monospace' }}>Finanzas de Walter &amp; Olin</p>
      <h1 style={{ fontSize: 24, margin: '2px 0 0', fontWeight: 600 }}>{titles[tab]}</h1>
      {tab === 'dashboard' && <EstadoConexion conexion={conexion} />}
      {tab !== 'ahorros' && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '6px 8px' }}>
          <button onClick={() => shiftMonth(-1)} style={btnGhost}><ChevronLeft size={18} /></button>
          <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{MESES[mes - 1]} {anio}</span>
          <button onClick={() => shiftMonth(1)} style={btnGhost}><ChevronRight size={18} /></button>
        </div>
      )}
    </div>
  );
}

function EstadoConexion({ conexion }) {
  const [abierto, setAbierto] = useState(false);
  const { status, ms, detalle, probar } = conexion;

  const estilos = {
    verificando: { color: C.textMute, punto: C.textMute, texto: 'Verificando conexión…' },
    ok:          { color: C.mint,     punto: C.mint,     texto: `Supabase conectada · ${ms} ms` },
    aviso:       { color: C.gold,     punto: C.gold,     texto: 'Conectada, pero sin datos' },
    error:       { color: C.coral,    punto: C.coral,    texto: 'Sin conexión con Supabase' },
  }[status];

  const alTocar = () => {
    if (detalle) setAbierto((a) => !a);
    else probar();
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={alTocar}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 99,
          padding: '5px 11px', cursor: 'pointer', color: estilos.color,
          fontSize: 11.5, fontFamily: 'monospace',
        }}
      >
        <span style={{
          width: 7, height: 7, borderRadius: 99, background: estilos.punto, flexShrink: 0,
          animation: status === 'verificando' ? 'latido 1s ease-in-out infinite' : 'none',
        }} />
        {estilos.texto}
        {detalle && <ChevronDown size={12} style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />}
      </button>

      {abierto && detalle && (
        <div style={{ marginTop: 6, padding: '8px 10px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10 }}>
          <p style={{ margin: 0, fontSize: 11.5, color: C.textDim, lineHeight: 1.5 }}>{detalle}</p>
          <button onClick={probar} style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', padding: 0, color: C.mint, fontSize: 11.5, cursor: 'pointer' }}>
            <RefreshCw size={11} /> Reintentar
          </button>
        </div>
      )}
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    { id: 'dashboard', label: 'Resumen', icon: LayoutGrid },
    { id: 'ingresos', label: 'Ingresos', icon: TrendingUp },
    { id: 'egresos', label: 'Egresos', icon: TrendingDown },
    { id: 'ahorros', label: 'Ahorros', icon: PiggyBank },
  ];
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(16,21,28,0.97)', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-around', padding: '10px 4px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
      {items.map(({ id, label, icon: Icon }) => {
        const active = tab === id;
        return (
          <button key={id} onClick={() => setTab(id)} style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: active ? C.mint : C.textMute, cursor: 'pointer' }}>
            <Icon size={21} strokeWidth={active ? 2.4 : 1.8} />
            <span style={{ fontSize: 10.5, fontWeight: active ? 600 : 400 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Dashboard({ mes, anio, fin, dolar }) {
  const { ingresos, egresos, tarjeta, categorias } = fin;
  const cot = dolar.valor;
  const enMes = (arr, m, y) => arr.filter((r) => r.anio === y && (r.anual || r.mes === m));

  const tarjetaEnMes = (m, y) => tarjeta.reduce((acc, g) => {
    const inicio = g.desdeAnio * 12 + (g.desdeMes - 1);
    const ultima = inicio + g.cuotas - 1;
    const objetivo = y * 12 + (m - 1);
    if (objetivo < inicio || objetivo > ultima) return acc;
    return acc + toARS(g.total / g.cuotas, g.moneda, cot);
  }, 0);

  const ingresosEnMes = (m, y) => enMes(ingresos, m, y).reduce((a, r) => a + toARS(r.monto, r.moneda, cot), 0);
  const egresosEnMes = (m, y) => enMes(egresos, m, y).reduce((a, r) => a + toARS(r.monto, r.moneda, cot), 0) + tarjetaEnMes(m, y);

  const totalIn = ingresosEnMes(mes, anio);
  const totalOut = egresosEnMes(mes, anio);
  const balance = totalIn - totalOut;

  const trend = useMemo(() => {
    const out = [];
    for (let i = 5; i >= 0; i--) {
      let m = mes - i, y = anio;
      while (m < 1) { m += 12; y -= 1; }
      out.push({ label: MESES_CORTO[m - 1], ingresos: Math.round(ingresosEnMes(m, y)), egresos: Math.round(egresosEnMes(m, y)) });
    }
    return out;
  }, [mes, anio, ingresos, egresos, tarjeta, cot]);

  const porCategoria = categorias.map((cat) => {
    const v = cat.especial === 'tarjeta'
      ? tarjetaEnMes(mes, anio)
      : enMes(egresos.filter((e) => e.catId === cat.id), mes, anio).reduce((a, r) => a + toARS(r.monto, r.moneda, cot), 0);
    return { name: cat.nombre, value: Math.round(v) };
  }).filter((c) => c.value > 0);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.mint, marginBottom: 4 }}><ArrowUpRight size={14} /><span style={{ fontSize: 12, color: C.textDim }}>Ingresos</span></div>
          <p style={{ fontFamily: 'monospace', fontSize: 17, margin: 0 }}>${fmt(totalIn)}</p>
        </div>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.coral, marginBottom: 4 }}><ArrowDownRight size={14} /><span style={{ fontSize: 12, color: C.textDim }}>Egresos</span></div>
          <p style={{ fontFamily: 'monospace', fontSize: 17, margin: 0 }}>${fmt(totalOut)}</p>
        </div>
      </div>

      <div style={{ ...card, background: balance >= 0 ? C.mintSoft : C.coralSoft, border: `1px solid ${balance >= 0 ? C.mintBorder : C.coralBorder}`, marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: C.textDim, margin: '0 0 4px' }}>{balance >= 0 ? 'Excedente del mes' : 'Déficit del mes'}</p>
        <p style={{ fontSize: 28, fontWeight: 600, fontFamily: 'monospace', color: balance >= 0 ? C.mint : C.coral, margin: 0 }}>
          {balance >= 0 ? '+' : '-'}${fmt(Math.abs(balance))}
        </p>
        <DolarNota dolar={dolar} />
      </div>

      <div style={{ ...card, marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px' }}>Últimos 6 meses</h3>
        <div style={{ height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} barGap={2}>
              <XAxis dataKey="label" tick={{ fill: C.textMute, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(v) => `$${fmt(v)}`} labelStyle={{ color: C.text }} />
              <Bar dataKey="ingresos" fill={C.mint} radius={[4, 4, 0, 0]} />
              <Bar dataKey="egresos" fill={C.coral} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px' }}>Egresos por categoría</h3>

        {porCategoria.length === 0 ? (
          // Antes esta tarjeta desaparecía sin más, y no había forma de saber si
          // no había datos o si algo se había roto.
          <div style={{ padding: '28px 8px', textAlign: 'center' }}>
            <PiggyBank size={22} color={C.textMute} style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>
              No hay egresos en {MESES[mes - 1].toLowerCase()} de {anio}.
            </p>
            <p style={{ fontSize: 11.5, color: C.textMute, margin: '4px 0 0', lineHeight: 1.5 }}>
              Cargalos desde la solapa Egresos, o cambiá de mes con las flechas de arriba.
            </p>
          </div>
        ) : (
          <>
            <div style={{ height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porCategoria} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                    {porCategoria.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} formatter={(v) => `$${fmt(v)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
              {porCategoria.map((c, i) => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                  <span style={{ color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.name}</span>
                  <span style={{ fontFamily: 'monospace', color: C.textDim }}>${fmt(c.value)}</span>
                  <span style={{ fontFamily: 'monospace', color: C.textMute, minWidth: 34, textAlign: 'right' }}>
                    {Math.round((c.value / totalOut) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DolarNota({ dolar }) {
  const fecha = dolar.fecha
    ? new Date(dolar.fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
      <span style={{ fontSize: 11, color: dolar.status === 'error' ? C.gold : C.textMute, fontFamily: 'monospace' }}>
        {dolar.status === 'cargando' && 'Buscando cotización…'}
        {dolar.status === 'ok' && `Dólar oficial $${fmt(dolar.valor)} · ${fecha}`}
        {dolar.status === 'error' && `Sin conexión — usando $${fmt(dolar.valor)}`}
      </span>
      <button onClick={dolar.recargar} style={{ ...btnGhost, padding: 2 }} aria-label="Actualizar cotización">
        <RefreshCw size={11} style={{ opacity: dolar.status === 'cargando' ? 0.4 : 1 }} />
      </button>
    </div>
  );
}

const INGRESO_VACIO = { tipo: 'salario', nombre: '', monto: '', moneda: 'ARS', anual: false };

function Ingresos({ mes, anio, fin, dolar }) {
  const [show, setShow] = useState(false);
  const [editando, setEditando] = useState(null);   // la fila original, o null si es alta
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [form, setForm] = useState(INGRESO_VACIO);

  const visibles = fin.ingresos.filter((r) => r.anio === anio && (r.anual || r.mes === mes));
  const total = visibles.reduce((a, r) => a + toARS(r.monto, r.moneda, dolar), 0);
  const totalUsd = visibles.reduce((a, r) => a + (r.moneda === 'USD' ? Number(r.monto) : 0), 0);

  const cerrar = () => { setShow(false); setEditando(null); setAviso(null); setForm(INGRESO_VACIO); };

  const abrirEdicion = (r) => {
    setForm({ tipo: r.tipo, nombre: r.nombre, monto: String(r.monto), moneda: r.moneda, anual: r.anual });
    setEditando(r);
    setAviso(null);
    setShow(true);
  };

  const guardar = async () => {
    const monto = parseMonto(form.monto);
    if (!form.nombre.trim()) return setAviso('Poné un nombre.');
    if (!Number.isFinite(monto) || monto <= 0) return setAviso('El monto no es un número válido.');
    setAviso(null);
    setGuardando(true);
    // Al editar respetamos el mes original: un ingreso anual puede haberse
    // cargado en otro mes y no queremos moverlo sin que nos lo pidan.
    const fila = { ...form, nombre: form.nombre.trim(), monto, mes: editando ? editando.mes : mes, anio: editando ? editando.anio : anio };
    const ok = editando ? await fin.editar('ingresos', editando.id, fila) : await fin.agregar('ingresos', fila);
    setGuardando(false);
    if (ok) cerrar();
  };

  return (
    <div>
      <div style={{ ...card, background: C.mintSoft, border: `1px solid ${C.mintBorder}`, marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: C.textDim, margin: '0 0 4px' }}>Total de ingresos del mes</p>
        <p style={{ fontSize: 26, fontWeight: 600, color: C.mint, fontFamily: 'monospace', margin: 0 }}>${fmt(total)}</p>
        {totalUsd > 0 && (
          <p style={{ fontSize: 11, color: C.textMute, fontFamily: 'monospace', margin: '4px 0 0' }}>
            incluye US${fmt(totalUsd)} convertidos a ${fmt(totalUsd * dolar)}
          </p>
        )}
      </div>

      {!show ? (
        <button onClick={() => setShow(true)} style={{ width: '100%', border: `1px dashed ${C.border}`, background: 'none', color: C.textDim, borderRadius: 14, padding: '11px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', marginBottom: 12 }}>
          <Plus size={17} /> Agregar ingreso
        </button>
      ) : (
        <div style={{ ...card, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8, border: `1px solid ${editando ? C.mintBorder : C.border}` }}>
          {editando && <p style={{ fontSize: 11.5, color: C.mint, margin: 0, fontFamily: 'monospace' }}>Editando: {editando.nombre}</p>}
          <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
            {[['salario', 'Salario'], ['tercero', 'De terceros']].map(([v, l]) => (
              <button key={v} onClick={() => setForm((f) => ({ ...f, tipo: v }))} style={{ flex: 1, padding: '8px 0', fontSize: 12, border: 'none', background: form.tipo === v ? C.mint : 'transparent', color: form.tipo === v ? '#0B0F14' : C.textMute, cursor: 'pointer', fontWeight: form.tipo === v ? 600 : 400 }}>{l}</button>
            ))}
          </div>
          <input style={input} value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Sueldo, Alquiler cobrado…" />
          <div style={{ display: 'flex', gap: 6 }}>
            <input style={{ ...input, flex: 1, fontFamily: 'monospace' }} type="text" inputMode="decimal" value={form.monto} onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))} placeholder="Monto" />
            <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
              {['ARS', 'USD'].map((m) => (
                <button key={m} onClick={() => setForm((f) => ({ ...f, moneda: m }))} style={{ padding: '0 10px', fontSize: 11, fontFamily: 'monospace', border: 'none', background: form.moneda === m ? C.mint : 'transparent', color: form.moneda === m ? '#0B0F14' : C.textMute, cursor: 'pointer' }}>{m === 'ARS' ? '$' : 'US$'}</button>
              ))}
            </div>
          </div>
          <label style={{ display: 'flex', gap: 6, fontSize: 11, color: C.textDim, alignItems: 'center' }}>
            <input type="checkbox" checked={form.anual} onChange={(e) => setForm((f) => ({ ...f, anual: e.target.checked }))} /> Se repite todo el año
          </label>
          {aviso && <p style={{ fontSize: 11.5, color: C.coral, margin: 0 }}>{aviso}</p>}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={cerrar} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, color: C.textDim, borderRadius: 8, padding: '9px 0', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ flex: 2, background: C.mint, color: '#0B0F14', border: 'none', borderRadius: 8, padding: '9px 0', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Guardar ingreso'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibles.length === 0 && <p style={{ color: C.textMute, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No hay ingresos este mes.</p>}
        {visibles.map((r) => (
          <div key={r.id} style={{ ...card, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13.5, margin: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</p>
              <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 11, color: C.textMute }}>{r.tipo === 'salario' ? 'Salario' : 'Tercero'}</span>
                {r.anual && <span style={{ fontSize: 11, color: C.gold, display: 'flex', alignItems: 'center', gap: 3 }}><RefreshCw size={9} />anual</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.mint }}>{r.moneda === 'USD' ? 'US$' : '$'}{fmt(r.monto)}</span>
              <button onClick={() => abrirEdicion(r)} style={{ ...btnGhost, padding: 2 }} aria-label="Editar"><Pencil size={14} /></button>
              <button onClick={() => fin.borrar('ingresos', r.id)} style={{ ...btnGhost, padding: 2 }} aria-label="Borrar"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Egresos({ mes, anio, fin, dolar }) {
  const [open, setOpen] = useState(null);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCat, setNewCat] = useState('');

  const tarjetaDelMes = fin.tarjeta.filter((g) => {
    const inicio = g.desdeAnio * 12 + (g.desdeMes - 1);
    const ultima = inicio + g.cuotas - 1;
    const actual = anio * 12 + (mes - 1);
    return actual >= inicio && actual <= ultima;
  }).map((g) => {
    const inicio = g.desdeAnio * 12 + (g.desdeMes - 1);
    const actual = anio * 12 + (mes - 1);
    return { ...g, nro: actual - inicio + 1, cuota: g.total / g.cuotas };
  });

  const egresosDelMes = (catId) => fin.egresos.filter((r) => r.catId === catId && r.anio === anio && (r.anual || r.mes === mes));

  const totalCat = (cat) => cat.especial === 'tarjeta'
    ? tarjetaDelMes.reduce((a, g) => a + toARS(g.cuota, g.moneda, dolar), 0)
    : egresosDelMes(cat.id).reduce((a, r) => a + toARS(r.monto, r.moneda, dolar), 0);

  const totalGeneral = fin.categorias.reduce((a, c) => a + totalCat(c), 0);

  const addCat = async () => {
    if (!newCat.trim()) return;
    const ok = await fin.agregar('categorias', { nombre: newCat.trim(), icono: '📌', especial: null });
    if (ok) { setNewCat(''); setShowNewCat(false); }
  };

  return (
    <div>
      <div style={{ ...card, background: C.coralSoft, border: `1px solid ${C.coralBorder}`, marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: C.textDim, margin: '0 0 4px' }}>Total de egresos del mes</p>
        <p style={{ fontSize: 26, fontWeight: 600, color: C.coral, fontFamily: 'monospace', margin: 0 }}>${fmt(totalGeneral)}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {fin.categorias.map((cat) => cat.especial === 'tarjeta' ? (
          <TarjetaCard key={cat.id} cat={cat} open={open === cat.id} onToggle={() => setOpen(open === cat.id ? null : cat.id)} items={tarjetaDelMes} total={totalCat(cat)} mes={mes} anio={anio} fin={fin} />
        ) : (
          <CategoriaCard key={cat.id} cat={cat} open={open === cat.id} onToggle={() => setOpen(open === cat.id ? null : cat.id)} items={egresosDelMes(cat.id)} total={totalCat(cat)} mes={mes} anio={anio} fin={fin} />
        ))}
      </div>

      {showNewCat ? (
        <div style={{ display: 'flex', gap: 6, ...card, padding: 8 }}>
          <input style={input} autoFocus value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCat()} placeholder="Nombre de la categoría" />
          <button onClick={addCat} style={{ background: C.coral, color: '#0B0F14', border: 'none', borderRadius: 10, padding: '0 14px', fontWeight: 600, cursor: 'pointer' }}>Crear</button>
        </div>
      ) : (
        <button onClick={() => setShowNewCat(true)} style={{ width: '100%', border: `1px dashed ${C.border}`, background: 'none', color: C.textDim, borderRadius: 14, padding: '11px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
          <Plus size={17} /> Nueva categoría
        </button>
      )}
    </div>
  );
}

const EGRESO_VACIO = { nombre: '', monto: '', moneda: 'ARS', anual: false };

function CategoriaCard({ cat, open, onToggle, items, total, mes, anio, fin }) {
  const [form, setForm] = useState(EGRESO_VACIO);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const limpiar = () => { setForm(EGRESO_VACIO); setEditando(null); setAviso(null); };

  const abrirEdicion = (r) => {
    setForm({ nombre: r.nombre, monto: String(r.monto), moneda: r.moneda, anual: r.anual });
    setEditando(r);
    setAviso(null);
  };

  const guardar = async () => {
    const monto = parseMonto(form.monto);
    if (!form.nombre.trim()) return setAviso('Poné un nombre.');
    if (!Number.isFinite(monto) || monto <= 0) return setAviso('El monto no es un número válido.');
    setAviso(null);
    setGuardando(true);
    const fila = { catId: cat.id, ...form, nombre: form.nombre.trim(), monto, mes: editando ? editando.mes : mes, anio: editando ? editando.anio : anio };
    const ok = editando ? await fin.editar('egresos', editando.id, fila) : await fin.agregar('egresos', fila);
    setGuardando(false);
    if (ok) limpiar();
  };

  return (
    <div style={card}>
      <button onClick={onToggle} style={{ width: '100%', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: C.text, padding: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 500 }}><span>{cat.icono}</span>{cat.nombre}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.coral }}>${fmt(total)}</span>
          <ChevronDown size={15} style={{ color: C.textMute, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: '#10151C', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, border: `1px solid ${editando ? C.coralBorder : 'transparent'}` }}>
            {editando && <p style={{ fontSize: 11.5, color: C.coral, margin: 0, fontFamily: 'monospace' }}>Editando: {editando.nombre}</p>}
            <input style={input} value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Luz, Nafta…" />
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={{ ...input, flex: 1, fontFamily: 'monospace' }} type="text" inputMode="decimal" value={form.monto} onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))} placeholder="Monto" />
              <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                {['ARS', 'USD'].map((m) => (
                  <button key={m} onClick={() => setForm((f) => ({ ...f, moneda: m }))} style={{ padding: '0 10px', fontSize: 11, fontFamily: 'monospace', border: 'none', background: form.moneda === m ? C.coral : 'transparent', color: form.moneda === m ? '#0B0F14' : C.textMute, cursor: 'pointer' }}>{m === 'ARS' ? '$' : 'US$'}</button>
                ))}
              </div>
            </div>
            <label style={{ display: 'flex', gap: 6, fontSize: 11, color: C.textDim, alignItems: 'center' }}>
              <input type="checkbox" checked={form.anual} onChange={(e) => setForm((f) => ({ ...f, anual: e.target.checked }))} /> Se repite todo el año
            </label>
            {aviso && <p style={{ fontSize: 11.5, color: C.coral, margin: 0 }}>{aviso}</p>}
            <div style={{ display: 'flex', gap: 6 }}>
              {editando && (
                <button onClick={limpiar} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, color: C.textDim, borderRadius: 8, padding: '8px 0', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              )}
              <button onClick={guardar} disabled={guardando} style={{ flex: 2, background: C.coral, color: '#0B0F14', border: 'none', borderRadius: 8, padding: '8px 0', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Agregar gasto'}
              </button>
            </div>
          </div>
          {items.map((it) => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, alignItems: 'center' }}>
              <span style={{ color: C.textDim, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {it.nombre}{it.anual && <RefreshCw size={9} color={C.gold} />}
              </span>
              <span style={{ display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: 'monospace' }}>{it.moneda === 'USD' ? 'US$' : '$'}{fmt(it.monto)}</span>
                <button onClick={() => abrirEdicion(it)} style={{ ...btnGhost, padding: 0 }} aria-label="Editar"><Pencil size={13} /></button>
                <button onClick={() => fin.borrar('egresos', it.id)} style={{ ...btnGhost, padding: 0 }} aria-label="Borrar"><Trash2 size={13} /></button>
              </span>
            </div>
          ))}
          {!cat.predeterminada && (
            <button onClick={() => fin.borrar('categorias', cat.id)} style={{ background: 'none', border: 'none', color: C.coral, fontSize: 11, cursor: 'pointer', padding: 0, textAlign: 'left' }}>
              Eliminar categoría (borra también sus gastos)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const TARJETA_VACIA = { nombre: '', cuota: '', moneda: 'ARS', cuotas: '1' };

function TarjetaCard({ cat, open, onToggle, items, total, mes, anio, fin }) {
  const [form, setForm] = useState(TARJETA_VACIA);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const limpiar = () => { setForm(TARJETA_VACIA); setEditando(null); setAviso(null); };

  const abrirEdicion = (g) => {
    // En la base guardamos el total; en pantalla se trabaja con la cuota.
    setForm({ nombre: g.nombre, cuota: String(g.total / g.cuotas), moneda: g.moneda, cuotas: String(g.cuotas) });
    setEditando(g);
    setAviso(null);
  };

  const cuotaNum = parseMonto(form.cuota);
  const cuotasNum = Math.min(Math.max(parseInt(form.cuotas, 10) || 0, 0), 48);
  const totalCalculado = Number.isFinite(cuotaNum) && cuotasNum > 0 ? cuotaNum * cuotasNum : null;

  const guardar = async () => {
    if (!form.nombre.trim()) return setAviso('Poné un nombre.');
    if (!Number.isFinite(cuotaNum) || cuotaNum <= 0) return setAviso('El valor de la cuota no es válido.');
    if (cuotasNum < 1) return setAviso('Poné al menos 1 cuota.');
    setAviso(null);
    setGuardando(true);
    // Vos cargás la cuota (que es lo que dice el resumen); guardamos el total.
    const fila = {
      nombre: form.nombre.trim(),
      total: cuotaNum * cuotasNum,
      moneda: form.moneda,
      cuotas: cuotasNum,
      desdeMes: editando ? editando.desdeMes : mes,
      desdeAnio: editando ? editando.desdeAnio : anio,
    };
    const ok = editando ? await fin.editar('tarjeta', editando.id, fila) : await fin.agregar('tarjeta', fila);
    setGuardando(false);
    if (ok) limpiar();
  };

  const simbolo = form.moneda === 'USD' ? 'US$' : '$';

  return (
    <div style={card}>
      <button onClick={onToggle} style={{ width: '100%', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: C.text, padding: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 500 }}><CreditCard size={15} color={C.gold} />{cat.nombre}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.coral }}>${fmt(total)}</span>
          <ChevronDown size={15} style={{ color: C.textMute, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: '#10151C', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, border: `1px solid ${editando ? C.goldBorder : 'transparent'}` }}>
            {editando && <p style={{ fontSize: 11.5, color: C.gold, margin: 0, fontFamily: 'monospace' }}>Editando: {editando.nombre}</p>}
            <input style={input} value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Notebook, Viaje…" />
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={{ ...input, flex: 1, fontFamily: 'monospace' }} type="text" inputMode="decimal" value={form.cuota} onChange={(e) => setForm((f) => ({ ...f, cuota: e.target.value }))} placeholder="Valor de la cuota" />
              <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                {['ARS', 'USD'].map((m) => (
                  <button key={m} onClick={() => setForm((f) => ({ ...f, moneda: m }))} style={{ padding: '0 10px', fontSize: 11, fontFamily: 'monospace', border: 'none', background: form.moneda === m ? C.gold : 'transparent', color: form.moneda === m ? '#0B0F14' : C.textMute, cursor: 'pointer' }}>{m === 'ARS' ? '$' : 'US$'}</button>
                ))}
              </div>
            </div>
            <label style={{ display: 'flex', gap: 6, fontSize: 11, color: C.textDim, alignItems: 'center' }}>
              Cuotas <input type="text" inputMode="numeric" value={form.cuotas} onChange={(e) => setForm((f) => ({ ...f, cuotas: e.target.value.replace(/\D/g, '') }))} style={{ ...input, width: 50, padding: '4px 8px', fontFamily: 'monospace' }} />
            </label>
            {totalCalculado !== null && (
              <p style={{ fontSize: 11, color: C.textMute, margin: 0, fontFamily: 'monospace' }}>
                {cuotasNum} × {simbolo}{fmt(cuotaNum)} = {simbolo}{fmt(totalCalculado)} en total
              </p>
            )}
            {aviso && <p style={{ fontSize: 11.5, color: C.coral, margin: 0 }}>{aviso}</p>}
            <div style={{ display: 'flex', gap: 6 }}>
              {editando && (
                <button onClick={limpiar} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, color: C.textDim, borderRadius: 8, padding: '8px 0', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              )}
              <button onClick={guardar} disabled={guardando} style={{ flex: 2, background: C.gold, color: '#0B0F14', border: 'none', borderRadius: 8, padding: '8px 0', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Agregar gasto'}
              </button>
            </div>
          </div>
          {items.map((it) => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, alignItems: 'center' }}>
              <span style={{ color: C.textDim, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {it.nombre} <span style={{ fontSize: 11, color: C.textMute }}>cuota {it.nro}/{it.cuotas}</span>
              </span>
              <span style={{ display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: 'monospace' }}>{it.moneda === 'USD' ? 'US$' : '$'}{fmt(it.cuota)}</span>
                <button onClick={() => abrirEdicion(it)} style={{ ...btnGhost, padding: 0 }} aria-label="Editar"><Pencil size={13} /></button>
                <button onClick={() => fin.borrar('tarjeta', it.id)} style={{ ...btnGhost, padding: 0 }} aria-label="Borrar"><Trash2 size={13} /></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Ahorros({ fin, dolar }) {
  const [verEn, setVerEn] = useState('ARS');

  const fisicos = fin.ahorros.filter((a) => a.clase === 'fisico');
  const plazos = fin.ahorros.filter((a) => a.clase === 'plazo');
  const billeteras = fin.ahorros.filter((a) => a.clase === 'billetera');

  const totalARS = fin.ahorros.reduce((a, r) => a + toARS(r.monto, r.moneda, dolar), 0);
  const totalUSD = dolar > 0 ? totalARS / dolar : 0;

  const guardar = (clase, v) => {
    const fila = { clase, nombre: clase === 'fisico' ? null : v.nombre, monto: v.monto, moneda: clase === 'plazo' ? 'USD' : v.moneda };
    return v.id ? fin.editar('ahorros', v.id, fila) : fin.agregar('ahorros', fila);
  };

  return (
    <div>
      <div style={{ ...card, background: C.goldSoft, border: `1px solid ${C.goldBorder}`, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>Ahorro total</p>
          <div style={{ display: 'flex', border: `1px solid ${C.goldBorder}`, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            {['ARS', 'USD'].map((m) => (
              <button key={m} onClick={() => setVerEn(m)}
                style={{ padding: '4px 10px', fontSize: 11, fontFamily: 'monospace', border: 'none', cursor: 'pointer',
                  background: verEn === m ? C.gold : 'transparent', color: verEn === m ? '#0B0F14' : C.textMute,
                  fontWeight: verEn === m ? 600 : 400 }}>
                {m === 'ARS' ? '$' : 'US$'}
              </button>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 26, fontWeight: 600, color: C.gold, fontFamily: 'monospace', margin: '4px 0 0' }}>
          {verEn === 'ARS' ? `$${fmt(totalARS)}` : `US$${fmt(totalUSD)}`}
        </p>

        <p style={{ fontSize: 11, color: C.textMute, fontFamily: 'monospace', margin: '4px 0 0' }}>
          {verEn === 'ARS' ? `US$${fmt(totalUSD)}` : `$${fmt(totalARS)}`} al dólar ${fmt(dolar)}
        </p>
      </div>

      <Section title="Ahorros físicos" icon={Coins} items={fisicos}
        render={(it) => `${it.moneda === 'USD' ? 'US$' : '$'}${fmt(it.monto)}`}
        label={(it) => `Ahorro en ${it.moneda}`}
        fields={['monto', 'moneda']}
        onGuardar={(v) => guardar('fisico', v)}
        onRemove={(id) => fin.borrar('ahorros', id)} />

      <Section title="Plazos fijos (USD)" icon={Landmark} items={plazos}
        render={(it) => `US$${fmt(it.monto)}`}
        label={(it) => it.nombre}
        fields={['nombre', 'monto']} nombreLabel="Banco"
        onGuardar={(v) => guardar('plazo', v)}
        onRemove={(id) => fin.borrar('ahorros', id)} />

      <Section title="Billeteras digitales" icon={Wallet} items={billeteras}
        render={(it) => `${it.moneda === 'USD' ? 'US$' : '$'}${fmt(it.monto)}`}
        label={(it) => it.nombre}
        fields={['nombre', 'monto', 'moneda']} nombreLabel="Billetera"
        onGuardar={(v) => guardar('billetera', v)}
        onRemove={(id) => fin.borrar('ahorros', id)} />
    </div>
  );
}

const AHORRO_VACIO = { nombre: '', monto: '', moneda: 'ARS' };

function Section({ title, icon: Icon, items, render, onGuardar, onRemove, fields, nombreLabel, label }) {
  const [show, setShow] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [form, setForm] = useState(AHORRO_VACIO);

  const cerrar = () => { setShow(false); setEditando(null); setAviso(null); setForm(AHORRO_VACIO); };

  const abrirEdicion = (it) => {
    setForm({ nombre: it.nombre || '', monto: String(it.monto), moneda: it.moneda });
    setEditando(it);
    setAviso(null);
    setShow(true);
  };

  const submit = async () => {
    const monto = parseMonto(form.monto);
    if (fields.includes('nombre') && !form.nombre.trim()) return setAviso('Poné un nombre.');
    if (!Number.isFinite(monto) || monto <= 0) return setAviso('El monto no es un número válido.');
    setAviso(null);
    setGuardando(true);
    const ok = await onGuardar({ ...form, nombre: form.nombre.trim(), monto, id: editando?.id });
    setGuardando(false);
    if (ok) cerrar();
  };

  return (
    <div style={{ ...card, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 500 }}><Icon size={15} color={C.textDim} />{title}</span>
        <button onClick={() => (show ? cerrar() : setShow(true))} style={{ ...btnGhost, padding: 4 }} aria-label="Agregar">
          <Plus size={16} style={{ transform: show ? 'rotate(45deg)' : 'none', transition: 'transform .2s' }} />
        </button>
      </div>
      {show && (
        <div style={{ background: '#10151C', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10, border: `1px solid ${editando ? C.mintBorder : 'transparent'}` }}>
          {editando && <p style={{ fontSize: 11.5, color: C.mint, margin: 0, fontFamily: 'monospace' }}>Editando: {label(editando)}</p>}
          {fields.includes('nombre') && <input style={input} value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder={nombreLabel || 'Nombre'} />}
          <div style={{ display: 'flex', gap: 6 }}>
            <input style={{ ...input, flex: 1, fontFamily: 'monospace' }} type="text" inputMode="decimal" value={form.monto} onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))} placeholder="Monto" />
            {fields.includes('moneda') && (
              <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                {['ARS', 'USD'].map((m) => (
                  <button key={m} onClick={() => setForm((f) => ({ ...f, moneda: m }))} style={{ padding: '0 10px', fontSize: 11, fontFamily: 'monospace', border: 'none', background: form.moneda === m ? C.mint : 'transparent', color: form.moneda === m ? '#0B0F14' : C.textMute, cursor: 'pointer' }}>{m === 'ARS' ? '$' : 'US$'}</button>
                ))}
              </div>
            )}
          </div>
          {aviso && <p style={{ fontSize: 11.5, color: C.coral, margin: 0 }}>{aviso}</p>}
          <button onClick={submit} disabled={guardando} style={{ background: C.mint, color: '#0B0F14', border: 'none', borderRadius: 8, padding: '8px 0', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Guardar'}
          </button>
        </div>
      )}
      {items.length === 0 && <p style={{ color: C.textMute, fontSize: 12, textAlign: 'center', margin: '6px 0' }}>Sin registros todavía.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it) => (
          <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, alignItems: 'center' }}>
            <span style={{ color: C.textDim, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label(it)}</span>
            <span style={{ display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'monospace' }}>{render(it)}</span>
              <button onClick={() => abrirEdicion(it)} style={{ ...btnGhost, padding: 0 }} aria-label="Editar"><Pencil size={13} /></button>
              <button onClick={() => onRemove(it.id)} style={{ ...btnGhost, padding: 0 }} aria-label="Borrar"><Trash2 size={13} /></button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
