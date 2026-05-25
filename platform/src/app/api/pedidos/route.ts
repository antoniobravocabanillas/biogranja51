import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { Order, OrderItem } from "@/domain/commerce";
import { productSalePrice } from "@/domain/commerce";
import {
  createOrder,
  createStorefrontOrder,
  getCommerceState,
} from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type OrderRequest = {
  customerName?: string;
  phone?: string;
  address?: string;
  deliveryZoneId?: string;
  paymentMethodId?: string;
  items?: { productId: string; quantity: number }[];
};

function nextOrderNumber(orderCount: number): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
  })
    .format(new Date())
    .replaceAll("-", "");
  return `BG51-${today}-${String(orderCount + 1).padStart(4, "0")}`;
}

function orderResponse(order: Order, zoneName: string, paymentName: string) {
  const message = [
    `Hola BioGranja 51, deseo confirmar el pedido *${order.number}*:`,
    ...order.items.map(
      (item) =>
        `- ${item.quantity} x ${item.name} (${item.presentation})${
          item.subtotal === null
            ? " - precio por confirmar"
            : ` - S/ ${item.subtotal.toFixed(2)}`
        }`,
    ),
    `Entrega: ${zoneName}`,
    `Dirección: ${order.address}`,
    `Cliente: ${order.customerName} | ${order.phone}`,
    `Pago: ${paymentName}`,
    order.total === null
      ? "Total final: por confirmar según precios pendientes."
      : `Total estimado: S/ ${order.total.toFixed(2)}`,
  ].join("\n");

  return Response.json(
    {
      order,
      whatsappUrl: `https://wa.me/51936198468?text=${encodeURIComponent(message)}`,
    },
    { status: 201 },
  );
}

export async function POST(request: Request) {
  if (
    !isSupabaseConfigured() &&
    process.env.NODE_ENV === "production" &&
    process.env.ORDER_WRITE_ENABLED !== "true"
  ) {
    return Response.json(
      { error: "El registro de pedidos se habilitará al conectar la base productiva." },
      { status: 503 },
    );
  }

  try {
    const payload = (await request.json()) as OrderRequest;
    if (
      !payload.customerName?.trim() ||
      !payload.phone?.trim() ||
      !payload.address?.trim() ||
      !payload.deliveryZoneId ||
      !payload.paymentMethodId ||
      !payload.items?.length
    ) {
      return Response.json(
        { error: "Completa cliente, celular, entrega, pago y productos." },
        { status: 400 },
      );
    }

    const customerName = payload.customerName.trim();
    const phone = payload.phone.trim();
    const address = payload.address.trim();
    const itemsRequested = payload.items;
    if (
      itemsRequested.some(
        (item) =>
          !item.productId ||
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0 ||
          item.quantity > 100,
      )
    ) {
      return Response.json({ error: "El pedido contiene cantidades no válidas." }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      const created = await createStorefrontOrder({
        customerName,
        phone,
        address,
        deliveryZoneId: payload.deliveryZoneId,
        paymentMethodId: payload.paymentMethodId,
        items: itemsRequested,
      });
      revalidatePath("/gestion");
      revalidatePath("/gestion/pedidos");
      revalidatePath("/gestion/clientes");
      return orderResponse(created.order, created.zoneName, created.paymentName);
    }

    const state = await getCommerceState();
    const zone = state.deliveryZones.find(
      (entry) => entry.id === payload.deliveryZoneId && entry.active,
    );
    const payment = state.paymentMethods.find(
      (entry) => entry.id === payload.paymentMethodId && entry.active,
    );
    if (!zone || !payment) {
      return Response.json({ error: "Zona o medio de pago no disponible." }, { status: 400 });
    }

    const items: OrderItem[] = payload.items.map((requested) => {
      const product = state.products.find(
        (entry) => entry.id === requested.productId && entry.active,
      );
      if (
        !product ||
        !Number.isInteger(requested.quantity) ||
        requested.quantity <= 0 ||
        requested.quantity > 100
      ) {
        throw new Error("El pedido contiene un producto no disponible.");
      }
      const unitPrice = productSalePrice(product);
      return {
        productId: product.id,
        name: product.name,
        presentation: product.presentation,
        quantity: requested.quantity,
        unitPrice,
        subtotal: unitPrice === null ? null : unitPrice * requested.quantity,
        lotCode: null,
        allocatedQuantity: null,
        allocatedUnit: null,
        costTotal: null,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + (item.subtotal ?? 0), 0);
    const hasPendingPrice = items.some((item) => item.unitPrice === null);
    const deliveryFee =
      zone.freeFrom && subtotal >= zone.freeFrom && !hasPendingPrice ? 0 : zone.baseFee;
    const total = hasPendingPrice ? null : subtotal + deliveryFee;
    const number = nextOrderNumber(state.orders.length);
    const order: Order = {
      id: `ord-${randomUUID()}`,
      customerId: null,
      number,
      customerName,
      phone,
      address,
      deliveryZoneId: zone.id,
      paymentMethodId: payment.id,
      status: "pending_confirmation",
      items,
      subtotal,
      deliveryFee,
      total,
      hasPendingPrice,
      createdAt: new Date().toISOString(),
    };
    const createdOrder = await createOrder(order);
    revalidatePath("/gestion");
    revalidatePath("/gestion/pedidos");
    revalidatePath("/gestion/clientes");
    return orderResponse(createdOrder, zone.name, payment.name);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el pedido.";
    return Response.json({ error: message }, { status: 400 });
  }
}
