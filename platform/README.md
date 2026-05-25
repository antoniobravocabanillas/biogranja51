# BioGranja 51 Platform

Nueva plataforma comercial y operativa de BioGranja 51.

## Alcance Actual

- Portada premium centrada en confianza alimentaria, origen y experiencia.
- Distincion visual entre productos de origen propio y seleccionados.
- Catálogo y cotizador de entrega leídos desde una fuente administrable.
- Carga local de imágenes de producto en JPG, PNG o WebP para validar contenido.
- Registro previo del pedido y coordinación posterior mediante WhatsApp.
- Presentación y lista de interés para BioGranja Weekly Box mediante WhatsApp.
- Vista inicial del centro de gestion en `/gestion`.
- Administración en `/gestion/productos` y `/gestion/configuracion`.
- Panel comercial en `/gestion/pedidos` con estados controlados:
  confirmación, preparación, despacho, entrega o cancelación.
- CRM en `/gestion/clientes` con historial, valor de compra, notas,
  segmentación e interés en suscripción.
- Inventario en `/gestion/inventario` con recepción por lote, stock
  valorizado, mermas y reserva trazable para pedidos.
- Indicadores operativos iniciales calculados desde los pedidos registrados.

La web estatica existente permanece en la raiz del repositorio mientras se
construye y valida esta migracion.

## Datos Y Seguridad

Sin variables Supabase, `data/commerce.json` funciona como almacenamiento
local para validar catálogo, precios, delivery y pagos. Con variables
Supabase configuradas, la aplicación usa PostgreSQL, Auth y Storage.

Las migraciones de PostgreSQL/Supabase están en `supabase/migrations/` e incluyen:

- productos y presentaciones;
- delivery y métodos de pago;
- tiendas, almacén/molino y roles;
- pedidos numerados, lotes de inventario y auditoría;
- políticas de lectura pública y edición para personal autenticado.
- checkout público transaccional y bucket de imágenes de productos.
- consolidación de clientes recurrentes por celular y ficha comercial.
- movimientos de inventario auditables y asignación de lote al despacho.

Con Supabase activo, los datos de pedidos y las escrituras del panel requieren
sesión de un usuario asignado en `staff_assignments`. Las imágenes se guardan
en Supabase Storage, preparado para el runtime de Netlify.

## Supabase Y Netlify

Configurar las variables copiando `.env.example` a `.env.local` y siguiendo
la guía de activación en `../docs/CONFIGURACION_SUPABASE_NETLIFY.md`.

El repositorio incluye `../netlify.toml`, que dirige el build a `platform/` y
declara el adaptador Next.js para la migracion desde la web estatica actual.
Netlify ejecuta SSR, Proxy y route handlers con su runtime OpenNext
administrado.

## Desarrollo

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000/` para la tienda y
`http://localhost:3000/gestion` para la vista operativa.

## Validacion

```bash
npm run lint
npm run build
```

## Proximas Capacidades

Consultar los documentos del directorio `../docs/`:

- `PLATAFORMA_EMPRESARIAL.md`
- `MODELO_DE_DATOS.md`
- `ROADMAP_IMPLEMENTACION.md`
