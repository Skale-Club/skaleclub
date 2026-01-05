import { useCategories } from "@/hooks/use-booking";
import { Link } from "wouter";
import { ArrowRight, Star, Shield, Clock } from "lucide-react";
import { CartSummary } from "@/components/CartSummary";

export default function Home() {
  const { data: categories, isLoading } = useCategories();

  return (
    <div className="pb-24">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="container-custom mx-auto relative z-10">
          <div className="max-w-2xl">
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] mb-6 text-slate-900">
              Your Home, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
                Impeccably Clean.
              </span>
            </h1>
            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              Professional cleaning services tailored to your lifestyle. 
              Book trusted cleaners in seconds, not hours.
            </p>
            <div className="flex gap-4 flex-col sm:flex-row">
              <Link href="/services">
                <button className="px-8 py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2">
                  Book a Service
                  <ArrowRight className="w-5 h-5" />
                </button>
              </Link>
              <Link href="#how-it-works">
                <button className="px-8 py-4 bg-white text-slate-700 font-bold rounded-xl border border-gray-200 shadow-sm hover:bg-gray-50 transition-all">
                  How it Works
                </button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 -z-10 w-[800px] h-[800px] bg-gradient-to-bl from-blue-50 to-transparent rounded-full blur-3xl opacity-60 transform translate-x-1/3 -translate-y-1/4"></div>
      </section>

      {/* Features Grid */}
      <section className="py-16 bg-white/50">
        <div className="container-custom mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Star, title: "Top Rated Professionals", desc: "Every cleaner is vetted, background-checked, and highly rated." },
            { icon: Clock, title: "Flexible Scheduling", desc: "Book 7 days a week. Reschedule easily when life happens." },
            { icon: Shield, title: "Satisfaction Guarantee", desc: "Not happy? We'll re-clean for free. Your peace of mind matters." },
          ].map((feature, i) => (
            <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-blue-50 text-primary rounded-xl flex items-center justify-center mb-6">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-slate-500">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="py-20">
        <div className="container-custom mx-auto">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Services</h2>
              <p className="text-slate-600">Choose from our wide range of professional cleaning solutions.</p>
            </div>
            <Link href="/services" className="text-primary font-semibold hover:underline hidden md:block">
              View all services
            </Link>
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
                <Link key={category.id} href={`/services?category=${category.id}`}>
                  <div className="group cursor-pointer relative overflow-hidden rounded-2xl h-80 shadow-md hover:shadow-xl transition-all duration-500">
                    {/* Placeholder unsplash images based on category name */}
                    {/* Cleaners, Sofa, Carpet */}
                    <img 
                      src={
                        category.slug === 'upholstery' ? "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=800&q=80" :
                        category.slug === 'carpet' ? "https://images.unsplash.com/photo-1527512962299-633446c6eb06?w=800&q=80" :
                        "https://images.unsplash.com/photo-1581578731117-104f2a412729?w=800&q=80"
                      }
                      alt={category.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 p-8">
                      <h3 className="text-2xl font-bold text-white mb-2 group-hover:translate-x-2 transition-transform">
                        {category.name}
                      </h3>
                      <p className="text-gray-300 text-sm opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                        {category.description}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <CartSummary />
    </div>
  );
}
