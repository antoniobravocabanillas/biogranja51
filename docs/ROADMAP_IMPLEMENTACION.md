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

Criterio de salida: cada venta tiene costo y origen identificables.

## Sprint 3 - Pollo, Huevos Y Molino

Objetivo: capturar la ventaja productiva propia.

- Lotes de aves y ponedoras.
- Consumos, mortalidad, pesos, postura y cosecha.
- Catalogo de insumos del molino y precios historicos.
- Formula versionada con validaciones de porcentaje y costo.
- Ordenes internas de alimento y costo por lote.
- Comparacion alimento consumido vs. peso producido.

Criterio de salida: se conoce el costo real de producir pollo y huevos.

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
