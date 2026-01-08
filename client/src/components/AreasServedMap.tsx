import { MapPin, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export function AreasServedMap() {
  return (
    <section className="py-20 bg-white overflow-hidden">
      <div className="container-custom mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm font-medium mb-6">
              <MapPin className="w-4 h-4" />
              Service Areas
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Areas We Serve</h2>
            
            <div className="mb-4">
              <Link href="/services">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full transition-all flex items-center justify-center gap-2 text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5">
                  Book Now
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>

            <p className="text-slate-600 text-lg mb-8 leading-relaxed">
              We provide professional cleaning services within 40 minutes of Framingham, Massachusetts. Check the map to see if we cover your location.
            </p>
          </div>
          
          <div className="h-[450px] rounded-2xl overflow-hidden shadow-2xl border border-slate-100 lg:col-span-1">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d377855.19116817169!2d-71.4939223!3d42.2789235!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89e38f9069d30561%3A0x8670868f02901968!2sFramingham%2C%20MA!5e0!3m2!1sen!2susa!4v1704739200000!5m2!1sen!2susa"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen={true}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </div>
      </div>
    </section>
  );
}
