import { Service } from "@shared/schema";
import { Clock, ImageIcon } from "lucide-react";

interface ServiceCardProps {
  service: Service;
}

export function ServiceCard({ service }: ServiceCardProps) {
  return (
    <div className="group bg-light-gray rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full">
      <div className="relative w-full pt-[75%] bg-slate-100 overflow-hidden">
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
        <h3 className="text-xl font-bold text-slate-900 group-hover:text-primary transition-colors mb-1">
          {service.name}
        </h3>
        
        <p className="text-slate-500 text-sm mb-4 flex-grow">
          {service.description || "Professional service tailored to your needs."}
        </p>
        
        <div className="flex flex-col">
          <span className="text-lg font-bold text-slate-900 mb-6">
            ${service.price}
          </span>
        </div>
      </div>
    </div>
  );
}
