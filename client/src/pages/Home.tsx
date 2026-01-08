import { useCategories } from "@/hooks/use-booking";
import { Link, useLocation } from "wouter";
import { ArrowRight, Star, Shield, Clock, Phone } from "lucide-react";
import { CartSummary } from "@/components/CartSummary";
import heroImage from "@assets/Persona-Mobile_1767749022412.png";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";

export default function Home() {
  const { data: categories, isLoading } = useCategories();
  const [, setLocation] = useLocation();
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  const displayPhone = companySettings?.phone || "(303) 309 4226";
  const telPhone = displayPhone.replace(/\D/g, '');

  const handleCategoryClick = (categoryId: number) => {
    setLocation(`/services?category=${categoryId}&scroll=true`);
  };

  return (
    <div className="pb-24">
      {/* Hero Section */}
      <section className="relative min-h-[500px] flex items-end pt-4 pb-0 overflow-hidden bg-[#1C53A3]">
        <div className="container-custom mx-auto relative z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-end">
            <div className="text-white pt-20 pb-16 lg:pb-24">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-sm font-medium mb-6 border border-white/30">
                <Shield className="w-4 h-4" />
                Trusted Cleaning Experts!
              </div>
              <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] mb-6 font-display">
                <span className="text-white">Your 5-star</span> <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                  cleaning company
                </span>
              </h1>
              <p className="text-xl text-blue-50/80 mb-8 leading-relaxed max-w-xl">
                We provide top-quality cleaning services ensuring a spotless environment for your home and office.
              </p>
              <div className="flex gap-4 flex-col sm:flex-row items-center">
                <Link href="/services">
                  <button className="px-8 py-4 bg-[#FFFF01] hover:bg-[#e6e600] text-black font-bold rounded-full transition-all flex items-center justify-center gap-2 text-lg">
                    Get Instant Price
                  </button>
                </Link>
                <a href={`tel:${telPhone}`} className="px-8 py-4 bg-transparent text-white font-bold rounded-full border border-white/30 hover:bg-white/10 transition-all flex items-center gap-2 text-lg">
                  <Phone className="w-5 h-5" />
                  {displayPhone}
                </a>
              </div>
            </div>
            <div className="relative flex h-full items-end justify-center lg:justify-end self-end mt-8 lg:mt-0">
              <img 
                src={heroImage} 
                alt="Cleaning Professionals" 
                className="w-full max-w-[280px] sm:max-w-md lg:max-w-[600px] object-contain drop-shadow-2xl translate-y-0 scale-100 origin-bottom"
              />
            </div>
          </div>
        </div>
        
        {/* Modern Creative Blue Gradient Background */}
        <div className="absolute inset-0 bg-[#1C53A3]">
          <div className="absolute inset-0 opacity-60" style={{ 
            background: `
              radial-gradient(circle at 20% 30%, #4facfe 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, #a8d8ff 0%, transparent 50%),
              radial-gradient(circle at 50% 80%, #1C53A3 0%, transparent 50%),
              linear-gradient(135deg, #1C53A3 0%, #74abe2 100%)
            ` 
          }}></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#1C53A3] via-[#1C53A3]/20 to-transparent"></div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="relative z-20 -mt-10">
        <div className="container-custom mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 overflow-hidden">
            {[
              { icon: Star, title: "100% Satisfaction Guarantee", desc: "Our quality is guaranteed." },
              { icon: Shield, title: "Fully-vetted Cleaning Crew", desc: "Trusted professionals only." },
              { icon: Clock, title: "Upfront Pricing & Easy Booking", desc: "Book in under 60 seconds." },
            ].map((feature, i) => (
              <div key={i} className="p-8 flex items-center gap-6 hover:bg-gray-50 transition-colors">
                <div className="w-12 h-12 bg-blue-50 text-primary rounded-full flex items-center justify-center shrink-0">
                  <feature.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-[#1D1D1D]">{feature.title}</h3>
                  <p className="text-sm text-slate-500">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20">
        <div className="container-custom mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Ready to Schedule?</h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">Select a category below to start your instant online booking.</p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {categories?.map((category) => (
                <div 
                  key={category.id} 
                  className="group cursor-pointer relative overflow-hidden rounded-2xl h-80 shadow-md hover:shadow-xl transition-all duration-500 border border-gray-100"
                  onClick={() => handleCategoryClick(category.id)}
                >
                  <img 
                    src={category.imageUrl || "https://images.unsplash.com/photo-1581578731117-104f2a412729?w=800&q=80"}
                    alt={category.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 p-8 w-full">
                    <h3 className="text-2xl font-bold text-white mb-2 group-hover:translate-x-2 transition-transform">
                      {category.name}
                    </h3>
                    <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                      {category.description}
                    </p>
                    <button className="w-full py-2 bg-[#FFFF01] hover:bg-[#e6e600] text-black font-bold rounded-lg opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all">
                      Book Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <CartSummary />
    </div>
  );
}
