import { Service } from "@shared/schema";
import { useCart } from "@/context/CartContext";
import { Clock, Check } from "lucide-react";
import { clsx } from "clsx";

interface ServiceCardProps {
  service: Service;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const { addItem, items, removeItem } = useCart();
  const isInCart = items.some((item) => item.id === service.id);

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 flex flex-col h-full">
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
      
      <button
        onClick={() => isInCart ? removeItem(service.id) : addItem(service)}
        className={clsx(
          "w-full py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2",
          isInCart
            ? "bg-green-50 text-green-600 border border-green-200 hover:bg-green-100"
            : "bg-slate-50 text-slate-900 hover:bg-primary hover:text-white"
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
    </div>
  );
}
