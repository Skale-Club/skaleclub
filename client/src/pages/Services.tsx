import { useCategories, useServices } from "@/hooks/use-booking";
import { ServiceCard } from "@/components/ui/ServiceCard";
import { CartSummary } from "@/components/CartSummary";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { clsx } from "clsx";

export default function Services() {
  const [location] = useLocation();
  // Simple query param parsing (wouter doesn't have built-in hook for this)
  const searchParams = new URLSearchParams(window.location.search);
  const initialCatId = searchParams.get("category") ? Number(searchParams.get("category")) : undefined;
  
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(initialCatId);
  
  const { data: categories } = useCategories();
  const { data: services, isLoading } = useServices(selectedCategory); // Passing undefined fetches all

  // Update state if URL changes (optional, but good for linking)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const catId = params.get("category");
    if (catId) setSelectedCategory(Number(catId));
    else setSelectedCategory(undefined);
  }, [location]);

  return (
    <div className="min-h-screen pb-32 pt-10">
      <div className="container-custom mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Select Services</h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Customize your cleaning package. Select the services you need, and we'll take care of the rest.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          <button
            onClick={() => {
              setSelectedCategory(undefined);
              window.history.pushState(null, "", "/services");
            }}
            className={clsx(
              "px-6 py-2.5 rounded-full font-medium transition-all duration-200",
              selectedCategory === undefined
                ? "bg-slate-900 text-white shadow-lg"
                : "bg-white text-slate-600 border border-gray-200 hover:bg-gray-50"
            )}
          >
            All Services
          </button>
          {categories?.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                window.history.pushState(null, "", `/services?category=${cat.id}`);
              }}
              className={clsx(
                "px-6 py-2.5 rounded-full font-medium transition-all duration-200",
                selectedCategory === cat.id
                  ? "bg-primary text-white shadow-lg shadow-primary/25"
                  : "bg-white text-slate-600 border border-gray-200 hover:bg-gray-50"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Services Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services?.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
            {services?.length === 0 && (
              <div className="col-span-full text-center py-20 text-slate-400">
                No services found in this category.
              </div>
            )}
          </div>
        )}
      </div>
      <CartSummary />
    </div>
  );
}
