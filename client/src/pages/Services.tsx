import { useCategories, useServices, useSubcategories } from "@/hooks/use-booking";
import { ServiceCard } from "@/components/ui/ServiceCard";
import { CartSummary } from "@/components/CartSummary";
import { useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { clsx } from "clsx";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { trackViewServices } from "@/lib/analytics";

export default function Services() {
  const [location] = useLocation();
  // Simple query param parsing (wouter doesn't have built-in hook for this)
  const searchParams = new URLSearchParams(window.location.search);
  const initialCatId = searchParams.get("category") ? Number(searchParams.get("category")) : undefined;
  const initialSubCatId = searchParams.get("subcategory") ? Number(searchParams.get("subcategory")) : undefined;
  
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(initialCatId);
  const [selectedSubcategory, setSelectedSubcategory] = useState<number | undefined>(initialSubCatId);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const { data: categories } = useCategories();
  const { data: subcategories } = useSubcategories(selectedCategory);
  const { data: services, isLoading } = useServices(selectedCategory, selectedSubcategory);
  const { data: allServices } = useQuery<any[]>({
    queryKey: ['/api/services'],
  });

  const categoriesWithServices = categories?.filter(cat => 
    allServices?.some(s => s.categoryId === cat.id)
  );

  const subcategoriesWithServices = subcategories?.filter(sub => 
    allServices?.some(s => s.subcategoryId === sub.id)
  );

  const filteredServices = services?.filter(service => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      service.name.toLowerCase().includes(query) ||
      (service.description?.toLowerCase().includes(query))
    );
  });

  const hasTrackedView = useRef(false);

  useEffect(() => {
    if (!hasTrackedView.current && services && services.length > 0) {
      const categoryName = selectedCategory 
        ? categories?.find(c => c.id === selectedCategory)?.name 
        : 'All Services';
      trackViewServices(
        categoryName,
        services.slice(0, 10).map(s => ({ id: s.id, name: s.name, price: Number(s.price) }))
      );
      hasTrackedView.current = true;
    }
  }, [services, selectedCategory, categories]);

  // Update state if URL changes (optional, but good for linking)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const catId = params.get("category");
    const subCatId = params.get("subcategory");
    if (catId) setSelectedCategory(Number(catId));
    else setSelectedCategory(undefined);
    if (subCatId) setSelectedSubcategory(Number(subCatId));
    else setSelectedSubcategory(undefined);

    // Scroll to services top if requested
    if (params.get("scroll") === "true") {
      const element = document.getElementById("services-top");
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
    
    hasTrackedView.current = false;
  }, [location]);

  return (
    <div className="min-h-[60vh] pb-32 pt-10" id="services-top">
      <div className="container-custom mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-slate-900">Select Services</h1>

          {/* Search + Category Filter Pills */}
          <div className="relative">
            {/* Expanded Search Overlay */}
            {isSearchOpen && (
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <div className="w-full max-w-md relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search services..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => {
                      if (!searchQuery) {
                        setIsSearchOpen(false);
                      }
                    }}
                    className="w-full pl-12 pr-12 py-2.5 bg-white border border-gray-200 rounded-full shadow-lg focus:outline-none transition-all text-slate-900 placeholder:text-slate-400"
                    data-testid="input-search-services"
                  />
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setIsSearchOpen(false);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                    aria-label="Close search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className={clsx(
              "flex overflow-x-auto w-full pb-4 lg:pb-0 gap-3 no-scrollbar lg:flex-wrap lg:justify-center scroll-smooth transition-opacity duration-200",
              isSearchOpen ? "opacity-0 pointer-events-none" : "opacity-100"
            )}>

              {/* Search Button (Circle) */}
              <button
                onClick={() => {
                  setIsSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }}
                className="w-11 h-11 shrink-0 flex items-center justify-center bg-white border border-gray-200 rounded-full shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all"
                aria-label="Search services"
              >
                <Search className="w-5 h-5 text-slate-500" />
              </button>

              {/* Category Filter Pills */}
              <button
                  onClick={() => {
                    setSelectedCategory(undefined);
                    setSelectedSubcategory(undefined);
                    window.history.pushState(null, "", "/services");
                  }}
                  className={clsx(
                    "px-6 py-2.5 rounded-full font-medium transition-all duration-200 whitespace-nowrap shrink-0",
                    selectedCategory === undefined
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 border border-gray-200 hover:bg-gray-50"
                  )}
                  data-testid="button-filter-all"
                >
                  All Services
                </button>
                {categoriesWithServices?.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSelectedSubcategory(undefined);
                      window.history.pushState(null, "", `/services?category=${cat.id}`);
                    }}
                    className={clsx(
                      "px-6 py-2.5 rounded-full font-medium transition-all duration-200 whitespace-nowrap shrink-0",
                      selectedCategory === cat.id
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-600 border border-gray-200 hover:bg-gray-50"
                    )}
                    data-testid={`button-filter-category-${cat.id}`}
                  >
                    {cat.name}
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Subcategory Filter Pills - only show when a category is selected */}
        {selectedCategory && subcategoriesWithServices && subcategoriesWithServices.length > 0 && (
          <div className="flex overflow-x-auto pb-4 justify-start lg:justify-center gap-2 mb-12 no-scrollbar lg:flex-wrap lg:pb-0 lg:px-4 scroll-smooth">
            <div className="shrink-0 w-4 lg:hidden" aria-hidden="true" />
            <button
              onClick={() => {
                setSelectedSubcategory(undefined);
                window.history.pushState(null, "", `/services?category=${selectedCategory}`);
              }}
              className={clsx(
                "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0",
                selectedSubcategory === undefined
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
              data-testid="button-filter-all-subcategories"
            >
              All
            </button>
            {subcategoriesWithServices.map((sub) => (
              <button
                key={sub.id}
                onClick={() => {
                  setSelectedSubcategory(sub.id);
                  window.history.pushState(null, "", `/services?category=${selectedCategory}&subcategory=${sub.id}`);
                }}
                className={clsx(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0",
                  selectedSubcategory === sub.id
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
                data-testid={`button-filter-subcategory-${sub.id}`}
              >
                {sub.name}
              </button>
            ))}
            <div className="shrink-0 w-4 lg:hidden" aria-hidden="true" />
          </div>
        )}

        {!selectedCategory && <div className="mb-6" />}
        {selectedCategory && (!subcategoriesWithServices || subcategoriesWithServices.length === 0) && <div className="mb-6" />}

        {/* Services Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-64 bg-gray-100 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredServices?.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
            {filteredServices?.length === 0 && (
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
