import { useCart } from "@/context/CartContext";
import { Link } from "wouter";
import { ArrowRight, Clock } from "lucide-react";

export function CartSummary() {
  const { items, totalPrice, totalDuration } = useCart();

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-2xl z-40 animate-in slide-in-from-bottom duration-300">
      <div className="container-custom mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-sm text-slate-500">Total Services</p>
            <p className="font-bold text-slate-900">{items.length} items</p>
          </div>
          <div className="hidden sm:block w-px h-10 bg-gray-200"></div>
          <div>
            <p className="text-sm text-slate-500">Duration</p>
            <div className="flex items-center gap-1 font-bold text-slate-900">
              <Clock className="w-3 h-3" />
              {Math.floor(totalDuration / 60)}h {totalDuration % 60}m
            </div>
          </div>
          <div className="hidden sm:block w-px h-10 bg-gray-200"></div>
          <div>
            <p className="text-sm text-slate-500">Estimated Total</p>
            <p className="font-bold text-primary text-xl">${totalPrice.toFixed(2)}</p>
          </div>
        </div>

        <Link href="/booking">
          <button className="w-full sm:w-auto px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
            Continue to Booking
            <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </div>
  );
}
