import { Building2, CheckCircle, Users, Award } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";

export default function AboutUs() {
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  const companyName = companySettings?.companyName || "Company Name";

  return (
    <div className="pt-24 pb-20">
      <section className="container-custom mx-auto mb-20">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">About Us</h1>
          <p className="text-xl text-slate-600 leading-relaxed mb-8">
            At {companyName}, we believe in empowering businesses to reach their full potential. Founded with a passion for excellence, we've become a trusted name in digital marketing services.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-12">
          {[
            { icon: Building2, title: "Local Expertise", desc: "Serving our community with pride and dedication." },
            { icon: CheckCircle, title: "Quality Guaranteed", desc: "We don't stop until you see results." },
            { icon: Users, title: "Professional Team", desc: "Experienced and highly trained specialists." },
            { icon: Award, title: "Premium Service", desc: "Transparent pricing and easy booking." }
          ].map((item, i) => (
            <div key={i} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <item.icon className="w-10 h-10 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">{item.title}</h3>
              <p className="text-slate-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-900 text-white py-20">
        <div className="container-custom mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Our Mission</h2>
            <p className="text-lg text-slate-300 mb-8 leading-relaxed">
              To provide top-tier marketing services that help you grow your business, allowing you to focus on what matters most. We use data-driven strategies and proven techniques to ensure real results for your company.
            </p>
          </div>
          <div className="rounded-3xl overflow-hidden aspect-video bg-slate-800 flex items-center justify-center">
             <Building2 className="w-20 h-20 text-slate-700" />
          </div>
        </div>
      </section>
    </div>
  );
}
