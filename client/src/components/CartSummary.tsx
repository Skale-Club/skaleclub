import { useCart } from "@/context/CartContext";
import { Link } from "wouter";
import { ArrowRight, Clock, Plus, Minus, X } from "lucide-react";

export function CartSummary() {
  const { items, totalPrice, totalDuration, updateQuantity, removeItem } = useCart();

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-blue-600 border-t border-blue-500 p-4 shadow-2xl z-40 animate-in slide-in-from-bottom duration-300">
      <div className="container-custom mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-white flex-1">
          <div className="flex flex-wrap items-center gap-4">
            {items.map((item) => (
              <div key={item.id} className="bg-blue-700/50 px-3 py-1.5 rounded-lg flex items-center gap-2 border border-blue-400/30">
                <span className="text-sm font-medium max-w-[100px] truncate">{item.name}</span>
                <div className="flex items-center bg-blue-800/50 rounded-md p-0.5 gap-1">
                  <button
                    onClick={() => {
                      if (item.quantity > 1) {
                        updateQuantity(item.id, item.quantity - 1);
                      } else {
                        removeItem(item.id);
                      }
                    }}
                    className="p-1 hover:bg-blue-700 rounded transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="p-1 hover:bg-blue-700 rounded transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <button 
                  onClick={() => removeItem(item.id)}
                  className="p-1 hover:bg-red-500/30 rounded transition-colors text-blue-200 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="hidden md:block w-px h-10 bg-blue-400 opacity-30"></div>
          
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-blue-100 opacity-70">Duration</p>
              <div className="flex items-center gap-1 font-bold">
                <Clock className="w-3 h-3" />
                {Math.floor(totalDuration / 60)}h {totalDuration % 60}m
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-blue-100 opacity-70">Estimated Total</p>
              <p className="font-bold text-xl">${totalPrice.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <Link href="/booking?step=2">
          <button className="w-full md:w-auto px-8 py-3 bg-white text-blue-600 font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
            Continue to Booking
            <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </div>
  );
}
