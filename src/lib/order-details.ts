import { z } from "zod";
import { checkoutSchema } from "./validation";
import { buildDeliveryNotes } from "./delivery";

// One immutable snapshot is saved in the same transaction as the order.
export function createOrderDetails(input: z.infer<typeof checkoutSchema>, number: string) {
  const buyer = {
    firstName: input.firstName, lastName: input.lastName,
    email: input.email, phone: input.phone,
  };
  const delivery = {
    version: 2 as const, additionalNotes: input.additionalNotes,
    requestedDate: input.requestedDate,
  };
  return {
    customer: { ...buyer, name: `${buyer.firstName} ${buyer.lastName}` },
    address: {
      state: input.state, city: input.city, address: input.address,
      complement: input.complement, buyer, delivery,
    },
    deliveryNotes: buildDeliveryNotes(delivery, number),
  };
}
