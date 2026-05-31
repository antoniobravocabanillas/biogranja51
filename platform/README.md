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
- Operacion de delivery con ventana horaria, responsable, control de empaque,
  perfil de reparto asignado, control de empaque, temperatura de salida y
  recepcion auditable por pedido.
- CRM en `/gestion/clientes` con historial, valor de compra, notas,
  segmentación e interés en suscripción.
- Crianza en `/gestion/crianza` con ingreso de pollitos vivos, mortalidad,
  curva de peso, consumo valorizable, costos productivos y salida faenada
  hacia inventario.
- Huevos en `/gestion/huevos` con lotes de ponedoras, recoleccion, descarte,
  costos y empaque de maples trazables hacia inventario.
- Molino en `/gestion/molino` con insumos valorizados, formulas versionadas y
  lotes de alimento costeados por kilogramo, saldo disponible y consumo
  trazable desde crianza o ponedoras.
- Abastecimiento del molino con proveedor, comprobante, control de calidad,
  saldo por insumo y consumo FIFO al producir alimento.
- Auditoria en `/gestion/auditoria` con excepciones operativas y bitacora.
- Inventario comercial en `/gestion/inventario` con productos listos para
  venta, stock valorizado, mermas y reserva trazable para pedidos.
- Cadena de frio para compras comerciales con documento, temperaturas,
  cuarentena y liberacion sanitaria antes del despacho.
- Finanzas en `/gestion/finanzas` con cobros, conciliacion, comprobantes,
  gastos por pedido y margen auditado.
- Expedientes en `/gestion/expedientes` con evidencias privadas, cobertura
  documental y reporte imprimible para exportar a PDF.
- Fichas publicas por QR en `/trazabilidad/[token]`, publicadas desde
  inventario sin exponer documentos, costos ni datos internos.
- Cuenta de cliente en `/cuenta` y portal `/mi-cuenta` con historial privado,
  seguimiento visual y datos de compra guardados para checkout precargado.
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
- ultima milla controlada con cadena de frio y receptor documentado.
- perfiles delivery reutilizables para programar responsables sin recaptura.
- perfil autenticado de cliente, preferencias de entrega/pago y lectura privada
  de sus propios pedidos.

Con Supabase activo, los datos de pedidos y las escrituras del panel requieren
sesión de un usuario asignado en `staff_assignments`. Las imágenes se guardan
en Supabase Storage, preparado para el runtime de Netlify.
Las evidencias operativas se almacenan en un bucket privado y se abren solo
mediante enlaces temporales para personal autenticado.

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
