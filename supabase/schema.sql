-- ============================================================================
--  FINANZAS DEL HOGAR — esquema SIN RLS
--  Base compartida, sin login. La anon key alcanza para leer y escribir todo.
--  Pegar entero en: Supabase → SQL Editor → New query → Run
-- ============================================================================

-- Si ya corriste la versión con RLS, esto la borra y arranca limpio:
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.seed_categorias();
drop table if exists public.egresos cascade;
drop table if exists public.ingresos cascade;
drop table if exists public.tarjeta_gastos cascade;
drop table if exists public.ahorros cascade;
drop table if exists public.categorias cascade;

create extension if not exists pgcrypto;

-- ─── CATEGORÍAS ─────────────────────────────────────────────────────────────
create table public.categorias (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  icono          text not null default '📌',
  especial       text check (especial in ('tarjeta')),   -- null = categoría común
  predeterminada boolean not null default false,
  creado_en      timestamptz not null default now()
);

-- ─── INGRESOS ───────────────────────────────────────────────────────────────
create table public.ingresos (
  id        uuid primary key default gen_random_uuid(),
  tipo      text not null check (tipo in ('salario','tercero')),
  nombre    text not null,
  monto     numeric(14,2) not null check (monto >= 0),
  moneda    text not null check (moneda in ('ARS','USD')),
  anual     boolean not null default false,
  mes       smallint not null check (mes between 1 and 12),
  anio      smallint not null check (anio between 2000 and 2100),
  creado_en timestamptz not null default now()
);

-- ─── EGRESOS ────────────────────────────────────────────────────────────────
create table public.egresos (
  id        uuid primary key default gen_random_uuid(),
  cat_id    uuid not null references public.categorias(id) on delete cascade,
  nombre    text not null,
  monto     numeric(14,2) not null check (monto >= 0),
  moneda    text not null check (moneda in ('ARS','USD')),
  anual     boolean not null default false,
  mes       smallint not null check (mes between 1 and 12),
  anio      smallint not null check (anio between 2000 and 2100),
  creado_en timestamptz not null default now()
);

-- ─── TARJETA DE CRÉDITO (gastos en cuotas) ──────────────────────────────────
create table public.tarjeta_gastos (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  total      numeric(14,2) not null check (total >= 0),
  moneda     text not null check (moneda in ('ARS','USD')),
  cuotas     smallint not null check (cuotas between 1 and 48),
  desde_mes  smallint not null check (desde_mes between 1 and 12),
  desde_anio smallint not null check (desde_anio between 2000 and 2100),
  creado_en  timestamptz not null default now()
);

-- ─── AHORROS (físicos, plazos fijos y billeteras en una sola tabla) ─────────
create table public.ahorros (
  id        uuid primary key default gen_random_uuid(),
  clase     text not null check (clase in ('fisico','plazo','billetera')),
  nombre    text,                                   -- banco o billetera; null en físicos
  monto     numeric(14,2) not null check (monto >= 0),
  moneda    text not null default 'ARS' check (moneda in ('ARS','USD')),
  tna       numeric(5,2),
  creado_en timestamptz not null default now()
);

-- ─── ÍNDICES ────────────────────────────────────────────────────────────────
create index ingresos_periodo_idx on public.ingresos (anio, mes);
create index egresos_periodo_idx  on public.egresos  (anio, mes);
create index egresos_cat_idx      on public.egresos  (cat_id);
create index tarjeta_desde_idx    on public.tarjeta_gastos (desde_anio, desde_mes);

-- ─── SIN RLS: la anon key puede todo ────────────────────────────────────────
-- Supabase ya da estos permisos por defecto; los dejo explícitos para que se
-- vea qué está pasando y sea fácil revertirlo.
alter table public.categorias     disable row level security;
alter table public.ingresos       disable row level security;
alter table public.egresos        disable row level security;
alter table public.tarjeta_gastos disable row level security;
alter table public.ahorros        disable row level security;

grant select, insert, update, delete
  on public.categorias, public.ingresos, public.egresos,
     public.tarjeta_gastos, public.ahorros
  to anon, authenticated;

-- ─── CATEGORÍAS PREDETERMINADAS ─────────────────────────────────────────────
insert into public.categorias (nombre, icono, especial, predeterminada) values
  ('Tarjeta de crédito', '💳', 'tarjeta', true),
  ('Servicios',          '💡', null,      true),
  ('Mantenimiento auto', '🚗', null,      true),
  ('Alquiler',           '🏠', null,      true),
  ('Alimentos',          '🛒', null,      true),
  ('Prepaga de salud',   '🩺', null,      true),
  ('Recreación',         '🎉', null,      true);

-- ============================================================================
--  DESPUÉS DE CORRER ESTO:
--  Settings → API → copiá Project URL y anon public key y pegalos en las dos
--  primeras líneas del .jsx. No hace falta crear ningún usuario.
--
--  SI ALGÚN DÍA PUBLICÁS LA APP EN UNA URL, hay que volver a proteger la base:
--  agregar user_id, reactivar RLS y las policies. Avisame y te paso ese paso.
-- ============================================================================
