import React, { createContext, useContext, useState, useEffect } from "react";
import type { Service } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface CartContextType {
  items: Service[];
  addItem: (service: Service) => void;
  removeItem: (serviceId: number) => void;
  clearCart: () => void;
  totalPrice: number;
  totalDuration: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Service[]>([]);
  const { toast } = useToast();

  const addItem = (service: Service) => {
    if (items.find((i) => i.id === service.id)) {
      toast({
        title: "Already in cart",
        description: `${service.name} is already added to your booking.`,
      });
      return;
    }
    setItems((prev) => [...prev, service]);
    toast({
      title: "Service added",
      description: `${service.name} added to booking.`,
      className: "bg-primary text-primary-foreground",
    });
  };

  const removeItem = (serviceId: number) => {
    setItems((prev) => prev.filter((i) => i.id !== serviceId));
  };

  const clearCart = () => setItems([]);

  const totalPrice = items.reduce((sum, item) => sum + Number(item.price), 0);
  const totalDuration = items.reduce((sum, item) => sum + item.durationMinutes, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, clearCart, totalPrice, totalDuration }}
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
