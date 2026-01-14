import { useQuery } from "@tanstack/react-query";
import { Service } from "@shared/schema";
import { useCart } from "@/context/CartContext";
import { Clock, Check, ImageIcon, Plus, Minus, Sparkles, Loader2 } from "lucide-react";
import { clsx } from "clsx";

interface ServiceCardProps {
  service: Service;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const { addItem, items, removeItem, updateQuantity } = useCart();
  
  const cartItem = items.find((item) => item.id === service.id);
  const isInCart = !!cartItem;
  const quantity = cartItem?.quantity || 0;

  const { data: suggestedAddons = [], isLoading: addonsLoading, isError } = useQuery<Service[]>({
    queryKey: ['/api/services', service.id, 'addons'],
    queryFn: async () => {
      const res = await fetch(`/api/services/${service.id}/addons`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: isInCart,
    staleTime: 60000,
  });

  const filteredAddons = isError ? [] : suggestedAddons.filter(addon => !items.find(i => i.id === addon.id));

  return (
    <div className="group bg-light-gray rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full">
      {/* 4:3 Aspect Ratio Image - Clickable to add to booking */}
      <div
        className="relative w-full pt-[75%] bg-slate-100 overflow-hidden cursor-pointer"
        onClick={() => !isInCart && addItem(service)}
      >
        <div className="absolute top-2 right-2 z-10">
          <div className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-slate-600 text-xs font-bold flex items-center shadow-sm border border-slate-100">
            <Clock className="w-3 h-3 mr-1" />
            {service.durationMinutes} mins
          </div>
        </div>
        {service.imageUrl ? (
          <img
            src={service.imageUrl}
            alt={service.name}
            className="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.01]"
          />
        ) : (
          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center text-slate-300">
            <ImageIcon className="w-12 h-12" />
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col flex-grow">
        <h3
          className="text-xl font-bold text-slate-900 group-hover:text-primary transition-colors mb-1 cursor-pointer"
          onClick={() => !isInCart && addItem(service)}
        >
          {service.name}
        </h3>
        
        <p className="text-slate-500 text-sm mb-4 flex-grow">
          {service.description || "Professional cleaning service tailored to your needs."}
        </p>
        
        <div className="flex flex-col">
          <span className="text-lg font-bold text-slate-900 mb-6">
            ${service.price}
          </span>
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
            <div className="flex items-center bg-slate-200 rounded-xl p-0.5 gap-0.5">
              <button
                onClick={() => {
                  if (quantity > 1) {
                    updateQuantity(service.id, quantity - 1);
                  } else {
                    removeItem(service.id);
                  }
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-6 text-center font-bold text-slate-900 text-sm">
                {quantity}
              </span>
              <button
                onClick={() => updateQuantity(service.id, quantity + 1)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {isInCart && (suggestedAddons.length > 0 || addonsLoading) && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            {addonsLoading && suggestedAddons.length === 0 ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            ) : suggestedAddons.length > 0 ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-slate-700">Suggested Add-ons</span>
                </div>
                <div className="flex overflow-x-auto gap-3 pb-2 snap-x snap-mandatory scroll-smooth no-scrollbar">
                  {suggestedAddons.map(addon => {
                    const addonItem = items.find(i => i.id === addon.id);
                    const isAddonInCart = !!addonItem;
                    const addonQty = addonItem?.quantity || 0;

                    return (
                      <div key={addon.id} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg min-w-[280px] snap-start">
                        <div className="flex items-center gap-3">
                          {/* Addon Thumbnail 4:3 */}
                          <div className="w-20 h-15 shrink-0 rounded-md overflow-hidden bg-slate-200">
                            {addon.imageUrl ? (
                              <img
                                src={addon.imageUrl}
                                alt={addon.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <ImageIcon className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 mb-0.5">{addon.name}</p>
                            <p className="text-sm font-bold text-slate-900">${addon.price}</p>
                          </div>
                        </div>

                        <div className="flex justify-center">
                          {isAddonInCart ? (
                            <div className="flex items-center bg-white rounded-lg p-0.5 gap-1 border border-slate-200 shadow-sm">
                              <button
                                onClick={() => {
                                  if (addonQty > 1) {
                                    updateQuantity(addon.id, addonQty - 1);
                                  } else {
                                    removeItem(addon.id);
                                  }
                                }}
                                className="p-1.5 hover:bg-slate-50 rounded-md transition-colors text-slate-600"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-8 text-center text-sm font-bold text-slate-900">
                                {addonQty}
                              </span>
                              <button
                                onClick={() => updateQuantity(addon.id, addonQty + 1)}
                                className="p-1.5 hover:bg-slate-50 rounded-md transition-colors text-slate-600"
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addItem(addon)}
                              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                              data-testid={`button-add-addon-${addon.id}`}
                            >
                              Add to Booking
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
