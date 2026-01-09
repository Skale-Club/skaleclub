import { Link } from "wouter";
import { CheckCircle2, Home } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { trackPurchase } from "@/lib/analytics";

export default function Confirmation() {
  const { items, totalPrice, clearCart } = useCart();
  const hasTracked = useRef(false);
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  useEffect(() => {
    if (!hasTracked.current && items.length > 0) {
      const transactionId = `booking_${Date.now()}`;
      trackPurchase(
        transactionId,
        items.map(item => ({ id: item.id, name: item.name, price: Number(item.price), quantity: item.quantity })),
        totalPrice
      );
      hasTracked.current = true;
    }
    clearCart();
  }, []);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 bg-slate-50">
      <div className="bg-white p-12 rounded-3xl shadow-xl border border-gray-100 text-center max-w-lg w-full animate-in zoom-in duration-300">
        <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Booking Confirmed!</h1>
        <p className="text-slate-600 mb-8 leading-relaxed">
          Thank you for choosing {companySettings?.companyName || "Skleanings"}. We've sent a confirmation email with all the details. Our team will arrive at the scheduled time.
        </p>

        <div className="flex flex-col gap-4">
          <Link href="/">
            <button className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
              <Home className="w-4 h-4" /> Return Home
            </button>
          </Link>
          <Link href="/services">
            <button className="w-full py-3 bg-white text-slate-600 font-bold rounded-xl border border-gray-200 hover:bg-gray-50 transition-all">
              Book Another Service
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
