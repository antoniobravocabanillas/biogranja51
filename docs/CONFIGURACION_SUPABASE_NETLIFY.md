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
3. `platform/supabase/migrations/202605250001_customer_relationship_management.sql`
4. `platform/supabase/migrations/202605250002_inventory_lots_movements_dispatch.sql`
5. `platform/supabase/migrations/202605250003_poultry_rearing_and_commercial_handoff.sql`
6. `platform/supabase/migrations/202605250004_poultry_metrics_and_cost_tracking.sql`
7. `platform/supabase/migrations/202605250005_layer_flocks_and_egg_inventory.sql`
8. `platform/supabase/migrations/202605250006_mill_formulas_and_feed_batches.sql`
9. `platform/supabase/migrations/202605250007_feed_lot_consumption_traceability.sql`
10. `platform/supabase/migrations/202605250008_auditable_feed_supply_and_control.sql`
11. `platform/supabase/migrations/202605250009_commercial_cold_chain_and_sanitary_release.sql`
12. `platform/supabase/migrations/202605250010_financial_reconciliation_and_order_margin.sql`

La segunda migracion agrega:

- roles y politicas RLS para personal;
- checkout publico seguro mediante `create_storefront_order`;
- estados y acceso privado de pedidos;
- bucket `product-images` para fotos de productos.

La tercera migracion agrega:

- ficha comercial de clientes con segmento, notas e interes en suscripcion;
- ultima direccion y zona utilizada para seguimiento de delivery;
- consolidacion automatica por celular para que una recompra no duplique clientes.

La cuarta migracion agrega:

- recepcion de lotes con cantidad, unidad, costo, origen, sede y vencimiento;
- movimientos de ingreso y merma con auditoria;
- reserva de stock al asignar el lote que prepara cada pedido.

La quinta migracion corrige la separacion operativa del pollo:

- `bird_batches` y eventos para pollitos vivos en crianza;
- seguimiento de mortalidad, peso, alimento y etapa;
- faena como unico paso que convierte pollo propio en inventario comercial;
- rechazo de ingresos manuales de producto propio en inventario terminado.

La sexta migracion agrega control tecnico y economico de crianza:

- costo por kg del alimento consumido y valorizacion acumulada;
- valorizacion posterior de consumos registrados inicialmente sin precio;
- gastos de sanidad, cama, energia, mano de obra, transporte u otros;
- datos para peso, conversion alimenticia y costo por ave o kg vivo.

La septima migracion agrega produccion de huevos:

- lotes continuos de ponedoras y sus costos productivos;
- recolecciones diarias con descarte y saldo de huevos aptos;
- empaque de maples de 30 unidades que genera inventario comercial trazable.

La octava migracion agrega molino y formulacion:

- insumos con historial de precio por kg;
- formulas de alimento versionadas e importacion inicial de `Alimentacion Actual.xlsx`;
- aprobacion bloqueada si el lote no totaliza el objetivo o faltan precios;
- lotes molidos internos con costo trazable por kg.

La novena migracion conecta molino con produccion:

- saldo disponible por lote de alimento producido;
- consumo trazable desde crianza o ponedoras con costo automatico por kg;
- bloqueo de saldo insuficiente o destino productivo incorrecto;
- auditoria del descuento de alimento.

La decima migracion agrega abastecimiento auditable:

- proveedores y recepcion de lotes de insumos con comprobante y calidad;
- liberacion o rechazo de materia prima antes del uso productivo;
- consumo FIFO de insumos aprobados al producir un lote molido;
- costo real del alimento desde las compras consumidas;
- acceso del personal autorizado a la bitacora para `/gestion/auditoria`;
- transiciones de pedido registradas en auditoria.

La undecima migracion agrega cadena de frio comercial:

- recepcion de producto comprado con documento, lote proveedor, empaque y temperaturas;
- cuarentena inicial obligatoria para evitar despacho sin inspeccion;
- liberacion o rechazo sanitario con registro en auditoria;
- regularizacion de lotes historicos que aun no tienen expediente.

La duodecima migracion agrega cierre financiero:

- cobros por pedido con numero de operacion y estado de conciliacion;
- boletas o facturas asociadas a ventas con total confirmado;
- anulacion de comprobantes conservando motivo y evento auditable;
- gastos por pedido para reparto, empaque, comision u otros;
- alertas y margen auditado solo para pedidos entregados y cerrados.

Ejecutar solamente las migraciones que aun no se hayan aplicado al proyecto,
siempre respetando su orden.

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

El repositorio incluye `netlify.toml` en la raiz. Esta configuracion dirige el
build hacia `platform/` y declara el adaptador Next.js/OpenNext, permitiendo
migrar desde la web estatica actual sin cambiar los ajustes remotos antes de
aprobar el deploy. Agregar variables con alcance `Builds` y `Functions`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_XXXXXXXX
NETLIFY_NEXT_SKEW_PROTECTION=true
```

No habilitar `ADMIN_WRITE_ENABLED`, `ADMIN_READ_ENABLED` ni
`ORDER_WRITE_ENABLED` en produccion: con Supabase activo el acceso depende de
Auth y RLS.

### Recuperacion De Contrasena

En `Authentication > URL Configuration`, configurar:

```text
Site URL: https://biogranja51.com
Redirect URL: https://**--biogranja51.netlify.app/**
Redirect URL: http://localhost:3100/**
Redirect URL: https://biogranja51.com/gestion/restablecer
Redirect URL: https://biogranja51.com/**
```

El acceso de gestion expone `/gestion/recuperar`, que envia el correo seguro,
`/auth/confirm`, que valida `token_hash` del correo del lado servidor, y
`/gestion/restablecer`, que permite definir una nueva clave mediante Supabase
Auth.

Personalizar la plantilla `Reset password` en Supabase con marca BioGranja y
un enlace basado en `{{ .RedirectTo }}`, `{{ .TokenHash }}` y `type=recovery`.
El cuerpo personalizado elimina la referencia visible al proveedor. Para que
el remitente también use un dominio propio, se debe activar SMTP corporativo
en Supabase, por ejemplo `acceso@biogranja51.com`.

## 5. Vincular Y Desplegar En Netlify

El sitio puede vincularse al repositorio para construir en la infraestructura
de Netlify. Esto es especialmente recomendable para Next.js con Proxy.

### Desde Dashboard

1. Subir la rama a GitHub.
2. En Netlify, importar el repositorio o abrir el proyecto existente.
3. Netlify leera `netlify.toml`, construira desde `platform/` y aplicara el
   runtime Next.js.
4. Agregar las variables del punto anterior y desplegar.

### Desde CLI

Con sesion iniciada en Netlify CLI, para configurar variables:

```bash
netlify link
netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://TU-PROYECTO.supabase.co"
netlify env:set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "sb_publishable_XXXXXXXX"
netlify env:set NETLIFY_NEXT_SKEW_PROTECTION "true"
```

El flujo recomendado de despliegue es publicar una rama en GitHub para obtener
el Deploy Preview y, luego de aprobarlo, fusionar o desplegar a produccion
desde Netlify.

## 6. Verificacion De Lanzamiento

- La tienda publica lista productos y calcula delivery.
- Un pedido real queda registrado antes de abrir WhatsApp.
- `/gestion` redirige a `/gestion/login` sin sesion.
- El enlace `Olvidaste tu contrasena` envia correo y permite establecer una
  nueva clave en `/gestion/restablecer`.
- El administrador puede editar precios e imagenes.
- Una imagen subida retorna URL publica de Supabase Storage.
- Un pedido avanza por confirmacion, preparacion, despacho y entrega.
- `/gestion/clientes` muestra recurrencia y permite registrar preferencias comerciales.
- `/gestion/inventario` permite recibir lotes, registrar mermas y asignar stock a pedidos.
- `/gestion/crianza` registra pollitos vivos, grafica su evolucion, calcula costos y genera inventario solo al registrar faena.
- `/gestion/huevos` controla postura, descarte y genera inventario solo al empacar maples de huevos propios.
- `/gestion/molino` valida formulas, actualiza precios y registra lotes internos de alimento.
- `/gestion/inventario` mantiene compras en cuarentena hasta registrar cadena de frio y liberar calidad.
- `/gestion/auditoria` alerta lotes comprados sin expediente o sin liberacion sanitaria.
- `/gestion/finanzas` permite registrar cobros, conciliarlos, emitir comprobantes y valorar gastos.
- `/gestion/auditoria` muestra alertas de calidad, costos y trazabilidad junto con la bitacora operativa.

## Fuentes Oficiales

- Supabase SSR para Next.js: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Storage y RLS: https://supabase.com/docs/guides/storage/security/access-control
- Netlify para Next.js: https://docs.netlify.com/frameworks/next-js/overview/
- Variables en Netlify y SSR: https://docs.netlify.com/frameworks/environment-variables/
