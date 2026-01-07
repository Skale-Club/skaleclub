import React, { createContext, useContext, useState, useEffect } from "react";
import type { Service } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface CartItem extends Service {
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (service: Service) => void;
  removeItem: (serviceId: number) => void;
  updateQuantity: (serviceId: number, quantity: number) => void;
  clearCart: () => void;
  totalPrice: number;
  totalDuration: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const { toast } = useToast();

  const addItem = (service: Service) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === service.id);
      if (existing) return prev;
      return [...prev, { ...service, quantity: 1 }];
    });
  };

  const removeItem = (serviceId: number) => {
    setItems((prev) => prev.filter((i) => i.id !== serviceId));
  };

  const updateQuantity = (serviceId: number, quantity: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === serviceId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => setItems([]);

  const totalPrice = items.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );
  const totalDuration = items.reduce(
    (sum, item) => sum + item.durationMinutes * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalPrice,
        totalDuration,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
