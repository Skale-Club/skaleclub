import { MapPin } from "lucide-react";

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
            <p className="text-slate-600 text-lg mb-8 leading-relaxed">
              We provide professional cleaning services across the entire metropolitan area. Check the map to see if we cover your location.
            </p>
          </div>
          
          <div className="h-[450px] rounded-2xl overflow-hidden shadow-2xl border border-slate-100 lg:col-span-1">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d196281.1921319082!2d-105.02019!3d39.7642548!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x876b80aa231f17cf%3A0x118ef4f8278a36d6!2sDenver%2C%20CO!5e0!3m2!1sen!2susa!4v1700000000000!5m2!1sen!2susa"
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
