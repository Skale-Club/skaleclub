import { useCart } from "@/context/CartContext";
import { useAvailability, useCreateBooking } from "@/hooks/use-booking";
import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { Link, useLocation } from "wouter";
import { Trash2, Calendar as CalendarIcon, Clock, ChevronRight, CheckCircle2, ArrowLeft, ChevronLeft, Plus, Minus, X } from "lucide-react";
import { clsx } from "clsx";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";

// Helper to format time based on format setting
function formatTime(time24: string, timeFormat: string): string {
  if (timeFormat === '24h') return time24;
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Schema for the form
const bookingFormSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerEmail: z.string().email("Invalid email"),
  customerPhone: z.string().min(10, "Valid phone number required"),
  customerStreet: z.string().min(5, "Street address is required"),
  customerUnit: z.string().optional(),
  customerCity: z.string().min(2, "City is required"),
  customerState: z.string().min(2, "State is required"),
  paymentMethod: z.enum(["site", "online"]),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

export default function BookingPage() {
  const [step, setStep] = useState<2 | 3 | 4>(2);
  const { items, totalPrice, totalDuration, removeItem, updateQuantity } = useCart();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Booking State - start with tomorrow
  const [selectedDate, setSelectedDate] = useState<string>(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [viewDate, setViewDate] = useState<Date>(new Date());
  
  // API Hooks
  const { data: slots, isLoading: isLoadingSlots } = useAvailability(selectedDate, totalDuration);
  const createBooking = useCreateBooking();
  const { data: companySettings } = useQuery<{ timeFormat?: string }>({ queryKey: ['/api/company-settings'] });
  const timeFormat = companySettings?.timeFormat || '12h';
  
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      paymentMethod: "site",
    }
  });

  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleNextStep = (nextStep: 2 | 3 | 4) => {
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = (data: BookingFormValues) => {
    if (!selectedDate || !selectedTime) return;

    // Calculate end time simply for the frontend display/object construction
    // The real validation happens on backend usually, but we need to send it
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const endDate = new Date(); 
    endDate.setHours(hours, minutes + totalDuration);
    const endTime = format(endDate, "HH:mm");

    const fullAddress = `${data.customerStreet}${data.customerUnit ? `, ${data.customerUnit}` : ""}, ${data.customerCity}, ${data.customerState}`;

    createBooking.mutate({
      ...data,
      customerAddress: fullAddress,
      serviceIds: items.map(i => i.id),
      bookingDate: selectedDate,
      startTime: selectedTime,
      endTime: endTime,
      totalDurationMinutes: totalDuration,
      totalPrice: String(totalPrice),
    }, {
      onSuccess: () => {
        setLocation("/confirmation");
      },
      onError: (error) => {
        toast({
          title: "Booking Failed",
          description: error.message,
          variant: "destructive"
        });
      }
    });
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <Clock className="w-10 h-10 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-slate-500 mb-8">Add some services to get started.</p>
        <Link href="/services">
          <button className="px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:-translate-y-1 transition-all">
            Browse Services
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 py-8 min-h-[60vh]">
      <div className="container-custom mx-auto max-w-5xl mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* STEP 2: SCHEDULE */}
            {step === 2 && (
              <div ref={calendarRef} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 text-slate-900">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {/* Calendar Column */}
                  <div>
                    <div className="flex items-center justify-between mb-8">
                      <button 
                        onClick={() => setViewDate(subMonths(viewDate, 1))}
                        className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors border border-gray-100"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <h3 className="text-lg font-bold text-slate-900">{format(viewDate, "MMMM yyyy")}</h3>
                      <button 
                        onClick={() => setViewDate(addMonths(viewDate, 1))}
                        className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors border border-gray-100"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 mb-4">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                        <div key={day} className="text-center text-xs font-bold text-slate-400 py-2 uppercase tracking-wider">
                          {day.substring(0, 3)}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {(() => {
                        const monthStart = startOfMonth(viewDate);
                        const monthEnd = endOfMonth(monthStart);
                        const startDate = startOfWeek(monthStart);
                        const endDate = endOfWeek(monthEnd);
                        const rows = [];
                        let days = [];
                        let day = startDate;

                        while (day <= endDate) {
                          for (let i = 0; i < 7; i++) {
                            const currentDay = day;
                            const isCurrentMonth = isSameMonth(currentDay, monthStart);
                            const isSelected = selectedDate === format(currentDay, "yyyy-MM-dd");
                            const isToday = isSameDay(currentDay, new Date());
                            const isPast = currentDay < new Date() && !isToday;

                            days.push(
                              <button
                                key={currentDay.toString()}
                                disabled={!isCurrentMonth || isPast}
                                onClick={() => {
                                  setSelectedDate(format(currentDay, "yyyy-MM-dd"));
                                  setSelectedTime("");
                                }}
                                className={clsx(
                                  "h-10 w-10 rounded-xl flex items-center justify-center text-sm font-semibold transition-all relative",
                                  !isCurrentMonth && "opacity-0 cursor-default",
                                  isCurrentMonth && isPast && "text-slate-200 cursor-not-allowed",
                                  isCurrentMonth && !isPast && !isSelected && "text-slate-600 hover:bg-slate-50 hover:text-primary border border-transparent",
                                  isSelected && "bg-primary text-white shadow-md shadow-primary/20",
                                  isToday && !isSelected && "text-primary border-primary/30 bg-primary/5"
                                )}
                              >
                                {format(currentDay, "d")}
                              </button>
                            );
                            day = addDays(day, 1);
                          }
                          rows.push(days);
                          days = [];
                        }
                        return rows;
                      })()}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-sm text-slate-400">
                      <Clock className="w-4 h-4" />
                      <span>Time zone: GMT-05:00 America/New_York (EST)</span>
                    </div>
                  </div>

                  {/* Slots Column */}
                  <div className="relative h-[440px]">
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/80 to-transparent z-10 pointer-events-none rounded-b-2xl" />
                    <ScrollArea className="h-full pr-4">
                      <div className="space-y-3 pb-20">
                        {isLoadingSlots ? (
                          [1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-14 bg-slate-50 border border-slate-100 rounded-xl animate-pulse"></div>
                          ))
                        ) : slots && slots.some(s => s.available) ? (
                          <div className="grid grid-cols-1 gap-3 pb-20">
                            {slots
                              .filter((slot) => slot.available)
                              .map((slot) => (
                                <div key={slot.time} className="px-1 py-1">
                                  <button
                                    onClick={() => setSelectedTime(slot.time)}
                                    className={clsx(
                                      "w-full py-4 px-6 rounded-xl font-bold transition-all border text-center text-sm",
                                      selectedTime === slot.time
                                        ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.01]"
                                        : "bg-white border-slate-200 text-slate-600 hover:border-primary hover:text-primary hover:bg-primary/5"
                                    )}
                                  >
                                    {formatTime(slot.time, timeFormat)}
                                  </button>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="text-center py-12 px-4 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                            <p className="text-slate-400 text-sm font-medium">
                              {selectedDate ? (slots && slots.length > 0 ? "No slots available for this date" : "No available slots for this duration.") : "Select a date to view available times."}
                            </p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: CONTACT INFORMATION */}
            {step === 3 && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setStep(2)} className="p-2 hover:bg-slate-100 rounded-full">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-2xl font-bold">Contact Details</h2>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Full Name</label>
                      <input
                        {...form.register("customerName")}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="John Doe"
                      />
                      {form.formState.errors.customerName && <p className="text-red-500 text-xs">{form.formState.errors.customerName.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Email</label>
                      <input
                        {...form.register("customerEmail")}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="john@example.com"
                      />
                      {form.formState.errors.customerEmail && <p className="text-red-500 text-xs">{form.formState.errors.customerEmail.message}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Phone Number</label>
                    <input
                      {...form.register("customerPhone")}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, "");
                        if (value.length > 10) value = value.slice(0, 10);
                        
                        let maskedValue = "";
                        if (value.length > 0) {
                          maskedValue = "(" + value.slice(0, 3);
                          if (value.length > 3) {
                            maskedValue += ") " + value.slice(3, 6);
                          }
                          if (value.length > 6) {
                            maskedValue += "-" + value.slice(6, 10);
                          }
                        }
                        e.target.value = maskedValue;
                        form.setValue("customerPhone", maskedValue, { shouldValidate: true });
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      placeholder="(555) 123-4567"
                    />
                    {form.formState.errors.customerPhone && <p className="text-red-500 text-xs">{form.formState.errors.customerPhone.message}</p>}
                  </div>

                  <button 
                    type="button"
                    onClick={async () => {
                      const isValid = await form.trigger(["customerName", "customerEmail", "customerPhone"]);
                      if (isValid) {
                        handleNextStep(4);
                      }
                    }}
                    className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all mt-8 text-lg flex items-center justify-center gap-2"
                  >
                    Continue to Address <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: ADDRESS & PAYMENT */}
            {step === 4 && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setStep(3)} className="p-2 hover:bg-slate-100 rounded-full">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-2xl font-bold">Address & Payment</h2>
                </div>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-10 gap-6">
                    <div className="space-y-2 col-span-7">
                      <label className="text-sm font-medium text-slate-700">Street Address</label>
                      <input
                        {...form.register("customerStreet")}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="123 Main St"
                      />
                      {form.formState.errors.customerStreet && <p className="text-red-500 text-xs">{form.formState.errors.customerStreet.message}</p>}
                    </div>

                    <div className="space-y-2 col-span-3">
                      <label className="text-sm font-medium text-slate-700">Unit / Apt (Optional)</label>
                      <input
                        {...form.register("customerUnit")}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="Apt 4B"
                      />
                    </div>

                    <div className="space-y-2 col-span-7">
                      <label className="text-sm font-medium text-slate-700">City</label>
                      <input
                        {...form.register("customerCity")}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="Framingham"
                      />
                      {form.formState.errors.customerCity && <p className="text-red-500 text-xs">{form.formState.errors.customerCity.message}</p>}
                    </div>

                    <div className="space-y-2 col-span-3">
                      <label className="text-sm font-medium text-slate-700">State</label>
                      <input
                        {...form.register("customerState")}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="MA"
                      />
                      {form.formState.errors.customerState && <p className="text-red-500 text-xs">{form.formState.errors.customerState.message}</p>}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100">
                    <label className="text-sm font-medium text-slate-700 mb-4 block">Payment Method</label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className={clsx(
                        "p-4 rounded-xl border cursor-pointer transition-all flex flex-col items-center gap-2 text-center",
                        form.watch("paymentMethod") === "site" 
                          ? "border-primary bg-blue-50 text-primary ring-1 ring-primary" 
                          : "border-gray-200 hover:bg-slate-50"
                      )}>
                        <input type="radio" value="site" {...form.register("paymentMethod")} className="hidden" />
                        <span className="font-bold">Pay on Site</span>
                        <span className="text-xs opacity-70">Cash or Card upon arrival</span>
                      </label>
                      <label className={clsx(
                        "p-4 rounded-xl border cursor-pointer transition-all flex flex-col items-center gap-2 text-center opacity-60",
                        form.watch("paymentMethod") === "online" 
                          ? "border-primary bg-blue-50 text-primary" 
                          : "border-gray-200"
                      )}>
                        <input type="radio" value="online" disabled {...form.register("paymentMethod")} className="hidden" />
                        <span className="font-bold">Pay Online</span>
                        <span className="text-xs opacity-70">Coming soon</span>
                      </label>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={createBooking.isPending}
                    className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-8 text-lg"
                  >
                    {createBooking.isPending ? "Confirming..." : `Confirm Booking - $${totalPrice.toFixed(2)}`}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Sticky Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 sticky top-24">
              <h3 className="font-bold text-xl mb-4 text-slate-900">Booking Summary</h3>
              
              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-700 font-medium text-sm leading-tight line-clamp-2 flex-1">{item.name}</span>
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                        aria-label="Remove item"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center bg-white rounded-lg p-0.5 gap-1 border border-slate-200 shadow-sm">
                        <button
                          onClick={() => {
                            if (item.quantity > 1) {
                              updateQuantity(item.id, item.quantity - 1);
                            } else {
                              removeItem(item.id);
                            }
                          }}
                          className="p-1 hover:bg-slate-50 rounded transition-colors text-slate-600"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold w-5 text-center text-slate-900">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-1 hover:bg-slate-50 rounded transition-colors text-slate-600"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-bold text-sm text-slate-900">${(Number(item.price) * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-2">
                 <div className="flex justify-between text-slate-500 text-sm">
                   <span>Duration</span>
                   <span>{Math.floor(totalDuration / 60)}h {totalDuration % 60}m</span>
                 </div>
                 {selectedDate && (
                   <div className="flex justify-between text-slate-500 text-sm">
                     <span>Date</span>
                     <span>{format(new Date(selectedDate), "MMM do, yyyy")}</span>
                   </div>
                 )}
                 {selectedTime && (
                   <div className="flex justify-between text-slate-500 text-sm">
                     <span>Time</span>
                     <span>{formatTime(selectedTime, timeFormat)}</span>
                   </div>
                 )}
              </div>

              <div className="border-t border-gray-100 pt-4 mt-4 flex justify-between items-center">
                <span className="font-bold text-lg text-slate-900">Total</span>
                <span className="font-bold text-2xl text-primary">${totalPrice.toFixed(2)}</span>
              </div>

              {/* Continue Buttons moved here */}
              <div className="mt-8">
                {step === 2 && (
                  <button 
                    disabled={!selectedDate || !selectedTime}
                    onClick={() => handleNextStep(3)}
                    className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Continue to Contact <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {step === 3 && (
                  <button 
                    onClick={async () => {
                      const isValid = await form.trigger(["customerName", "customerEmail", "customerPhone"]);
                      if (isValid) {
                        handleNextStep(4);
                      }
                    }}
                    className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                  >
                    Continue to Address <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
