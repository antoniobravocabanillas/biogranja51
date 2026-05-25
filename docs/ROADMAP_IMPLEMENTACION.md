# Roadmap De Implementacion

## Estrategia

La plataforma se construira por verticales completos: cada sprint debe dejar
una capacidad que se pueda probar y operar, no pantallas desconectadas.

## Sprint 0 - Base De Producto Y Tecnologia

Estado: iniciado en `platform/`.

- Nueva aplicacion Next.js con TypeScript.
- Portada inicial alineada al nuevo modelo de empresa.
- Vista inicial del centro de gestion.
- Arquitectura funcional y modelo de datos.
- Definicion de ambientes, base de datos y autenticacion.

Resultado: base revisable antes de conectar operaciones reales.

## Sprint 1 - Catalogo Y Pedido Real

Objetivo: vender correctamente los productos iniciales.

- Catálogo administrable: pollo entero, maple de huevos, res y cerdo en
  presentación de 500 g, y cuy entero a S/ 35. `Implementado en desarrollo`.
- Sello de origen propio o seleccionado. `Implementado`.
- Precio y publicación editables desde gestión. `Implementado en desarrollo`.
- Zonas referenciales de Trujillo y medios de pago configurables.
  `Implementado en desarrollo`.
- Cotizador con pedido numerado antes de abrir WhatsApp.
  `Implementado en desarrollo`.
- Posicionamiento premium visible: confianza alimentaria, entrega BioGranja y
  validación inicial de Weekly Box. `Implementado en desarrollo`.
- Base de datos PostgreSQL/Supabase y autenticación de administradores.
- Persistencia productiva del carrito y pedido en PostgreSQL/Supabase.
- Geocodificación de dirección, tarifa final y ventana de entrega.

Criterio de salida: un administrador cambia precio o stock y un cliente
genera un pedido consistente, sin editar codigo.

## Sprint 2 - Operacion Comercial E Inventario

Objetivo: controlar margen y cumplimiento.

- Panel de pedidos y estados, desde confirmación hasta entrega o cancelación.
  `Implementado en desarrollo`.
- Indicadores iniciales de pedidos, venta estimada, entregas y trazabilidad.
  `Implementado en desarrollo`.
- Clientes, direcciones, notas y recurrencia. `Implementado en desarrollo`.
- Compras a proveedores de res y cerdo.
- Recepcion, lotes, inventario y mermas. `Implementado en desarrollo`.
- Despacho asociado a lote. `Implementado en desarrollo`.
- Reporte de ventas y margen por linea.

Definicion operativa corregida:

- `Crianza avicola` recibe pollitos vivos por unidades, con peso inicial y
  costo por ave; no representan stock disponible para pedidos.
- `Inventario comercial` recibe res, cerdo u otros productos ya listos para
  venta, y recibe pollo propio solamente despues de la faena, expresado en kg.
- El paso de faena enlaza el lote vivo con el lote vendible para conservar
  trazabilidad y posteriormente calcular rendimiento y margen.
- Cada lote mide supervivencia, evolucion de peso, alimento acumulado y
  conversion alimenticia referencial.
- El costo acumulado integra pollitos, alimento valorizado y gastos de
  sanidad u operacion; el alimento sin precio permanece pendiente de valorizar.
- El alimento producido en Molino se consume por lote, descontando saldo y
  heredando automaticamente su costo por kg.

Criterio de salida: cada venta tiene costo y origen identificables.

## Sprint 3 - Pollo, Huevos Y Molino

Objetivo: capturar la ventaja productiva propia.

- Lotes de pollitos de engorde, ingreso y salida faenada. `Implementado en desarrollo`.
- Consumos, mortalidad, pesos y costos del pollo de engorde. `Implementado en desarrollo`.
- Lotes de ponedoras, postura, cosecha y empaque trazable de huevos. `Implementado en desarrollo`.
- Catalogo de insumos del molino y precios historicos. `Implementado en desarrollo`.
- Formula versionada con validaciones de porcentaje y costo. `Implementado en desarrollo`.
- Ordenes internas de alimento y costo por lote. `Implementado en desarrollo`.
- Comparacion alimento consumido vs. peso producido. `Implementado en desarrollo`.
- Recepcion de insumos con proveedor, documento, costo y liberacion de
  calidad. `Implementado en desarrollo`.
- Descuento FIFO de insumos reales al producir alimento y costo real de
  molienda. `Implementado en desarrollo`.
- Tablero de auditoria operativa con alertas de costo, calidad y
  trazabilidad. `Implementado en desarrollo`.
- Bitacora auditable para cambios de estado de pedidos. `Implementado en desarrollo`.

Definicion operativa de huevos:

- Las ponedoras se controlan como lote vivo continuo, separado del pollo de engorde.
- Cada recoleccion registra huevos cosechados y descarte; solo los aptos
  quedan disponibles para empaque.
- Un maple comercial descuenta 30 huevos aptos del lote y genera inventario
  trazable cuando el producto esta configurado como origen propio.
- El costo absorbido del maple se puede sugerir desde costo acumulado de
  ponedoras, alimento y operacion; al inicio del ciclo incluye la inversion
  de aves y disminuye a medida que aumenta la postura acumulada.

Criterio de salida: se conoce el costo real de producir pollo y huevos.

Definicion operativa del molino:

- `Alimentacion Actual.xlsx` se importa como referencia inicial para lotes de
  40 kg de Inicio, Crecimiento, Engorde y Mantenimiento.
- Las formulas ingresan como borradores: Crecimiento, Engorde y Mantenimiento
  exceden actualmente el 100% del lote, por lo que deben corregirse antes de
  aprobacion productiva.
- El sistema guarda precios historicos por insumo y recalcula costo por kg.
- Solo una version aprobada puede generar un lote molido con costo trazable
  para pollos, ponedoras o futuro servicio a terceros.
- La produccion solo consume lotes de insumo liberados por calidad, por orden
  de recepcion, dejando el movimiento y costo vinculados al lote molido.

## Fase De Auditoria Integral

Objetivo: poder sustentar origen, costo y movimiento de cada producto.

- Tablero de excepciones y bitacora operativa. `Implementado en desarrollo`.
- Compras de materias primas del molino con comprobante y calidad.
  `Implementado en desarrollo`.
- Proveedores, documentos y controles de calidad/cadena de frio para res,
  cerdo y producto comercial comprado. `Implementado en desarrollo`.
- Cuarentena automatica de compras comerciales y liberacion sanitaria antes
  de asignar stock a pedidos. `Implementado en desarrollo`.
- Margen por pedido desde venta, lote asignado y gastos registrados.
  `Implementado en desarrollo`.
- Evidencias adjuntas, responsables y exportacion del expediente por lote.
- Conciliacion de pagos Yape/Plin/transferencia y comprobantes de venta.
  `Implementado en desarrollo`.

Criterio de salida: una auditoria puede reconstruir proveedor o produccion,
costo, calidad, inventario, pedido, pago y entrega sin depender de registros
externos informales.

## Fase 2 - Recompra Y Expansion

- Suscripciones semanales/quincenales.
- Portal B2B y precios por volumen.
- Pasarela de pago y conciliacion.
- Comprobantes conectados a pedidos.
- Productos transformados, sujetos a validacion sanitaria.
- Molino para terceros, sujeto a formalizacion y aprobacion.

## Fase 3 - Sistema 360

- Produccion porcina propia.
- Registro de residuos y procesos de compost.
- Uso interno o venta de producto circular.
- Indicadores auditables de aprovechamiento.
- Evaluacion financiera para res propia.

## Decisiones Necesarias Antes De Sprint 1

| Decision | Opcion recomendada inicial |
| --- | --- |
| Cobertura | Trujillo por zonas y ventanas definidas |
| Venta de pollo | Precio por kg con peso estimado y ajuste confirmado |
| Checkout inicial | Pedido registrado + cierre asistido por WhatsApp |
| Pago inicial | Yape/transferencia contra confirmacion; pasarela despues |
| Stock | Inventario por lote y disponibilidad diaria |
| Gestion | Administrador y operador de ventas en primer release |
| Produccion | Registrar pollo propio desde el inicio; clasificar huevos y cuy solo al confirmar su procedencia |

## Definiciones Recibidas

| Tema | Definición inicial |
| --- | --- |
| Productos | Pollo entero; huevos por maple completo; res y cerdo por kg en presentaciones de 500 g; cuy entero |
| Precio conocido | Cuy entero: S/ 35 |
| Origen confirmado | Pollo propio; res y cerdo de proveedor; huevos y cuy pendientes de confirmación |
| Suscripción | Cobertura inicial urbana en Trujillo; tarifas calculadas según entrega |
| Pagos | Yape, Plin y transferencia bancaria |
| Roles | Administrador, ventas y almacén/molino |
| Expansión | Una tienda comercial inicial; soporte para futuras tiendas físicas |

## Datos Que Debe Proporcionar El Negocio

- Lista inicial de productos, presentaciones y precios objetivo.
- Zonas de reparto, costo y dias de entrega.
- Proveedores actuales de res y cerdo.
- Capacidad actual de pollos, huevos y molino.
- Persona responsable de pedidos, inventario y produccion.
- Medios de pago que se aceptaran en el lanzamiento.
