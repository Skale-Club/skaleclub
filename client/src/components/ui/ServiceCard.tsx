import { Service } from "@shared/schema";
import { useCart } from "@/context/CartContext";
import { Clock, Check, ImageIcon, Plus, Minus } from "lucide-react";
import { clsx } from "clsx";

interface ServiceCardProps {
  service: Service;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const { addItem, items, removeItem, updateQuantity } = useCart();
  const cartItem = items.find((item) => item.id === service.id);
  const isInCart = !!cartItem;
  const quantity = cartItem?.quantity || 0;

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 flex flex-col h-full">
      {/* 4:3 Aspect Ratio Image */}
      <div className="relative w-full pt-[75%] bg-slate-100">
        {service.imageUrl ? (
          <img 
            src={service.imageUrl} 
            alt={service.name}
            className="absolute top-0 left-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center text-slate-300">
            <ImageIcon className="w-12 h-12" />
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors">
            {service.name}
          </h3>
          <span className="text-lg font-bold text-slate-900">
            ${service.price}
          </span>
        </div>
        
        <p className="text-slate-500 text-sm mb-6 flex-grow">
          {service.description || "Professional cleaning service tailored to your needs."}
        </p>
        
        <div className="flex items-center text-slate-400 text-sm mb-6">
          <Clock className="w-4 h-4 mr-1.5" />
          {service.durationMinutes} mins
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => isInCart ? removeItem(service.id) : addItem(service)}
            className={clsx(
              "flex-grow py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2",
              isInCart
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            {isInCart ? (
              <>
                <Check className="w-4 h-4" /> Added
              </>
            ) : (
              "Add to Booking"
            )}
          </button>

          {isInCart && (
            <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
              <button
                onClick={() => {
                  if (quantity > 1) {
                    updateQuantity(service.id, quantity - 1);
                  } else {
                    removeItem(service.id);
                  }
                }}
                className="p-2 hover:bg-white rounded-lg transition-colors text-slate-600"
                aria-label="Decrease quantity"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center font-bold text-slate-900">
                {quantity}
              </span>
              <button
                onClick={() => updateQuantity(service.id, quantity + 1)}
                className="p-2 hover:bg-white rounded-lg transition-colors text-slate-600"
                aria-label="Increase quantity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
