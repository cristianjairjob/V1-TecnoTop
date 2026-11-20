"use client";
import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
export type CartLine = {
  productId: string;
  variantId?: string;
  unitColors?: string[];
  name: string;
  image: string;
  price: number;
  quantity: number;
  stock: number;
};
const key = "tecnotop.cart.v1";
function subscribe(fn: () => void) {
  window.addEventListener("storage", fn);
  window.addEventListener("tecnotop-cart", fn);
  return () => {
    window.removeEventListener("storage", fn);
    window.removeEventListener("tecnotop-cart", fn);
  };
}
function snapshot() {
  try {
    return localStorage.getItem(key) || "[]";
  } catch {
    return "[]";
  }
}
const CartContext = createContext<{
  items: CartLine[];
  setItems: (items: CartLine[]) => void;
}>({ items: [], setItems: () => {} });
export function CartProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const items = useMemo(() => {
    try {
      const a = JSON.parse(raw);
      return Array.isArray(a)
        ? (a.filter(
            (i) =>
              typeof i.productId === "string" &&
              Number.isInteger(i.quantity) &&
              i.quantity > 0 &&
              i.quantity <= 20,
          ) as CartLine[])
        : [];
    } catch {
      return [];
    }
  }, [raw]);
  function setItems(items: CartLine[]) {
    localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new Event("tecnotop-cart"));
  }
  return (
    <CartContext.Provider value={{ items, setItems }}>
      {children}
    </CartContext.Provider>
  );
}
export const useCart = () => useContext(CartContext);
