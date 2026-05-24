# Configuracion Supabase Y Netlify

## Objetivo

BioGranja 51 utiliza Supabase para catalogo, pedidos, clientes, roles e
imagenes. Netlify ejecuta la aplicacion Next.js con SSR y route handlers.

## 1. Variables De Supabase

En Supabase, abrir el proyecto y entrar a `Connect` o `Settings > API Keys`.
Copiar:

- Project URL.
- Publishable key, formato `sb_publishable_...`.

Supabase recomienda la clave publicable nueva; la clave `anon` legacy sigue
aceptada solo como compatibilidad temporal.

Crear `platform/.env.local` para desarrollo local:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_XXXXXXXX
```

No colocar claves `secret` o `service_role` en variables `NEXT_PUBLIC_`.

## 2. Ejecutar Migraciones

Desde Supabase SQL Editor, ejecutar en orden:

1. `platform/supabase/migrations/202605240001_commerce_foundation.sql`
2. `platform/supabase/migrations/202605240002_production_auth_orders_storage.sql`

La segunda migracion agrega:

- roles y politicas RLS para personal;
- checkout publico seguro mediante `create_storefront_order`;
- estados y acceso privado de pedidos;
- bucket `product-images` para fotos de productos.

Si el proyecto ya contiene la primera migracion, ejecutar solamente la
segunda.

## 3. Crear El Primer Administrador

1. En `Authentication > Users`, crear el usuario administrador por correo y
   contrasena.
2. Copiar el UUID del usuario.
3. Ejecutar esta asignacion, reemplazando el UUID:

```sql
insert into public.staff_assignments (user_id, role_id, location_id)
select
  'UUID_DEL_USUARIO'::uuid,
  role.id,
  location.id
from public.staff_roles role
cross join public.locations location
where role.code = 'ADMIN'
  and location.code = 'TIENDA-01';
```

El acceso administrativo queda disponible en `/gestion/login`.

## 4. Variables En Netlify

La aplicacion incluye `platform/netlify.toml`. En Netlify, configurar
`platform` como directorio base o paquete del sitio para activar el adaptador
Next.js/OpenNext. Agregar variables con alcance `Builds` y `Functions`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_XXXXXXXX
NETLIFY_NEXT_SKEW_PROTECTION=true
```

No habilitar `ADMIN_WRITE_ENABLED`, `ADMIN_READ_ENABLED` ni
`ORDER_WRITE_ENABLED` en produccion: con Supabase activo el acceso depende de
Auth y RLS.

## 5. Vincular Y Desplegar En Netlify

El sitio puede vincularse al repositorio para construir en la infraestructura
de Netlify. Esto es especialmente recomendable para Next.js con middleware.

### Desde Dashboard

1. Subir la rama a GitHub.
2. En Netlify, importar el repositorio o abrir el proyecto existente.
3. Definir `platform` como base/package directory en los ajustes de build.
4. Netlify leera `platform/netlify.toml` y aplicara el runtime Next.js.
4. Agregar las variables del punto anterior y desplegar.

### Desde CLI

Con sesion iniciada en Netlify CLI, para configurar variables:

```bash
netlify link
netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://TU-PROYECTO.supabase.co"
netlify env:set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "sb_publishable_XXXXXXXX"
netlify env:set NETLIFY_NEXT_SKEW_PROTECTION "true"
El flujo recomendado de despliegue es publicar una rama en GitHub para obtener
el Deploy Preview y, luego de aprobarlo, fusionar o desplegar a produccion
desde Netlify.
```

## 6. Verificacion De Lanzamiento

- La tienda publica lista productos y calcula delivery.
- Un pedido real queda registrado antes de abrir WhatsApp.
- `/gestion` redirige a `/gestion/login` sin sesion.
- El administrador puede editar precios e imagenes.
- Una imagen subida retorna URL publica de Supabase Storage.
- Un pedido avanza por confirmacion, preparacion, despacho y entrega.

## Fuentes Oficiales

- Supabase SSR para Next.js: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Storage y RLS: https://supabase.com/docs/guides/storage/security/access-control
- Netlify para Next.js: https://docs.netlify.com/frameworks/next-js/overview/
- Variables en Netlify y SSR: https://docs.netlify.com/frameworks/environment-variables/
