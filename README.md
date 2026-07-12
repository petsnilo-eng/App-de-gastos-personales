# Finanzas de Walter & Olin

App de finanzas del hogar. React + Vite, datos en Supabase (Postgres).

---

## 1. Supabase

1. Entrá a [supabase.com](https://supabase.com) → **New project**.
   - Name: `finanzas-walter-olin`
   - Database Password: generá una y guardala (no la vas a necesitar para la app, pero sí para el día que quieras entrar por SQL directo).
   - Region: **South America (São Paulo)** — es la más cercana a Argentina.
2. Esperá ~2 minutos a que termine de aprovisionar.
3. Barra izquierda → **SQL Editor** → **New query**.
4. Abrí `supabase/schema.sql` de este repo, copiá **todo** el contenido, pegalo y apretá **Run** (o Ctrl+Enter).
   - Debería decir *Success. No rows returned*.
5. Verificá: **Table Editor** → tienen que aparecer 5 tablas (`categorias`, `ingresos`, `egresos`, `tarjeta_gastos`, `ahorros`), y `categorias` con 7 filas ya cargadas.

### Las claves

**Settings** (engranaje abajo a la izquierda) → **API**. Necesitás dos cosas:

| Dónde dice | Qué copiar |
|---|---|
| **Project URL** | `https://abcdefgh.supabase.co` |
| **Project API keys → `anon` `public`** | un token largo que arranca con `eyJ...` |

> La `service_role` key **NO** se usa acá. Esa nunca va al navegador.

---

## 2. Probarlo en tu máquina (opcional pero recomendado)

```bash
npm install
cp .env.example .env
```

Editá `.env` con las dos claves de arriba, y:

```bash
npm run dev
```

Abrí http://localhost:5173. Cargá un gasto, recargá la página: tiene que seguir ahí.

---

## 3. GitHub

Si nunca lo usaste, instalá [Git](https://git-scm.com/downloads) y creá una cuenta en [github.com](https://github.com).

1. En GitHub: botón **+** arriba a la derecha → **New repository**.
   - Repository name: `finanzas-walter-olin`
   - **Private** (importante).
   - **No** tildes "Add a README" ni ".gitignore" — ya vienen en el proyecto.
   - **Create repository**.

2. En tu terminal, parado dentro de la carpeta del proyecto:

```bash
git init
git add .
git commit -m "Finanzas de Walter & Olin"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/finanzas-walter-olin.git
git push -u origin main
```

GitHub te va a pedir usuario y contraseña: la contraseña **no es tu contraseña**, es un *Personal Access Token* (Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token, con el permiso `repo`).

> El `.gitignore` ya excluye `.env`, así que tus claves **no** se suben. Revisá en GitHub que el archivo `.env` no aparezca en la lista.

---

## 4. Vercel

1. Entrá a [vercel.com](https://vercel.com) → **Sign up** → **Continue with GitHub**.
2. **Add New…** → **Project** → buscá `finanzas-walter-olin` → **Import**.
3. Vercel detecta Vite solo. No toques Framework Preset, Build Command ni Output Directory.
4. Abrí **Environment Variables** y cargá las dos:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://abcdefgh.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `eyJ...` |

   Dejá tildados los tres entornos (Production, Preview, Development).

5. **Deploy**. En ~1 minuto tenés la URL.

### Si cambiás una variable después

Vercel **no** rehace el build solo. Andá a **Deployments** → los tres puntos del último → **Redeploy**.

---

## 5. Ponerlo en el teléfono

Abrí la URL en el celular → menú del navegador → **Agregar a pantalla de inicio**. Queda como una app.

---

## Notas

- **La base va sin RLS.** Cualquiera que tenga la URL de la app puede leer y modificar los datos. Las variables de entorno no ocultan la `anon key`: Vite la compila dentro del JavaScript que baja el navegador. Si esto te preocupa, hay que activar Row Level Security y agregar un login.
- La cotización del dólar sale de [dolarapi.com](https://dolarapi.com) (`/v1/dolares/oficial`, campo `venta`). Si no responde, la app usa $1510 y lo avisa.
- Todos los montos en USD se convierten a pesos con esa cotización para calcular totales.
