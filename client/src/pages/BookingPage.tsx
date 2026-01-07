import { useCart } from "@/context/CartContext";
import { useAvailability, useCreateBooking } from "@/hooks/use-booking";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { Link, useLocation } from "wouter";
import { Trash2, Calendar as CalendarIcon, Clock, ChevronRight, CheckCircle2, ArrowLeft, ChevronLeft } from "lucide-react";
import { clsx } from "clsx";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

// Schema for the form
const bookingFormSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerEmail: z.string().email("Invalid email"),
  customerPhone: z.string().min(10, "Valid phone number required"),
  customerAddress: z.string().min(5, "Address is required"),
  paymentMethod: z.enum(["site", "online"]),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

export default function BookingPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const { items, totalPrice, totalDuration, removeItem } = useCart();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Booking State
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [viewDate, setViewDate] = useState<Date>(new Date());
  
  // API Hooks
  const { data: slots, isLoading: isLoadingSlots } = useAvailability(selectedDate, totalDuration);
  const createBooking = useCreateBooking();
  
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      paymentMethod: "site",
    }
  });

  const onSubmit = (data: BookingFormValues) => {
    if (!selectedDate || !selectedTime) return;

    // Calculate end time simply for the frontend display/object construction
    // The real validation happens on backend usually, but we need to send it
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const endDate = new Date(); 
    endDate.setHours(hours, minutes + totalDuration);
    const endTime = format(endDate, "HH:mm");

    createBooking.mutate({
      ...data,
      serviceIds: items.map(i => i.id),
      bookingDate: selectedDate,
      startTime: selectedTime,
      endTime: endTime,
      totalDurationMinutes: totalDuration,
      totalPrice: String(totalPrice),
      status: "confirmed" // Explicitly setting, though usually backend handles defaults
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
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="container-custom mx-auto max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Steps Indicator */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between mb-8">
              {[
                { id: 1, label: "Services" },
                { id: 2, label: "Schedule" },
                { id: 3, label: "Checkout" },
              ].map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                    step >= s.id ? "bg-primary text-white" : "bg-gray-100 text-slate-400"
                  )}>
                    {step > s.id ? <CheckCircle2 className="w-5 h-5" /> : s.id}
                  </div>
                  <span className={clsx(
                    "font-medium hidden sm:block",
                    step >= s.id ? "text-slate-900" : "text-slate-400"
                  )}>{s.label}</span>
                </div>
              ))}
            </div>

            {/* STEP 1: REVIEW SERVICES */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <h2 className="text-2xl font-bold mb-4">Review Services</h2>
                {items.map((item) => (
                  <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:border-primary/30 transition-all">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{item.name}</h3>
                      <p className="text-slate-500 text-sm">{item.durationMinutes} mins</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="font-bold text-lg">${item.price}</span>
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end pt-4">
                  <button 
                    onClick={() => setStep(2)}
                    className="px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2"
                  >
                    Select Date & Time <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: SCHEDULE */}
            {step === 2 && (
              <div className="bg-[#0B1120] p-8 rounded-2xl shadow-sm border border-slate-800 animate-in fade-in slide-in-from-bottom-4 text-white">
                <div className="flex items-center gap-4 mb-8">
                  <button onClick={() => setStep(1)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5 text-slate-400" />
                  </button>
                  <h2 className="text-2xl font-bold">Select Date & Time</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {/* Calendar Column */}
                  <div>
                    <div className="flex items-center justify-between mb-8">
                      <button 
                        onClick={() => setViewDate(subMonths(viewDate, 1))}
                        className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <h3 className="text-lg font-semibold">{format(viewDate, "MMMM yyyy")}</h3>
                      <button 
                        onClick={() => setViewDate(addMonths(viewDate, 1))}
                        className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 mb-4">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                        <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
                          {day}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
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
                                  "h-10 w-10 rounded-full flex items-center justify-center text-sm transition-all relative",
                                  !isCurrentMonth && "opacity-0 cursor-default",
                                  isCurrentMonth && isPast && "text-slate-700 cursor-not-allowed",
                                  isCurrentMonth && !isPast && !isSelected && "text-slate-300 hover:bg-slate-800",
                                  isSelected && "bg-primary text-white font-bold"
                                )}
                              >
                                {format(currentDay, "d")}
                                {isToday && !isSelected && (
                                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full"></div>
                                )}
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

                    <div className="mt-12">
                      <h4 className="text-sm font-medium text-slate-400 mb-4">Time zone</h4>
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span>GMT-05:00 America/New_York (EST)</span>
                      </div>
                    </div>
                  </div>

                  {/* Slots Column */}
                  <div>
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-3">
                        {isLoadingSlots ? (
                          [1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-14 bg-slate-900/50 border border-slate-800 rounded-lg animate-pulse"></div>
                          ))
                        ) : slots && slots.length > 0 ? (
                          slots.map((slot) => (
                            <button
                              key={slot.time}
                              disabled={!slot.available}
                              onClick={() => setSelectedTime(slot.time)}
                              className={clsx(
                                "w-full py-4 px-6 rounded-lg font-medium transition-all border text-center",
                                !slot.available && "opacity-20 cursor-not-allowed bg-transparent border-slate-800 text-slate-500",
                                slot.available && selectedTime === slot.time
                                  ? "bg-primary/20 border-primary text-primary shadow-lg shadow-primary/10"
                                  : slot.available && "bg-transparent border-slate-800 text-slate-300 hover:border-primary/50 hover:text-primary"
                              )}
                            >
                              {slot.time}
                            </button>
                          ))
                        ) : (
                          <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-xl">
                            <p className="text-slate-500 text-sm">
                              {selectedDate ? "No available slots for this duration." : "Select a date to view available times."}
                            </p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                <div className="flex justify-end pt-8 mt-8 border-t border-slate-800">
                  <button 
                    disabled={!selectedDate || !selectedTime}
                    onClick={() => setStep(3)}
                    className="px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                  >
                    Continue to Checkout <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: CHECKOUT */}
            {step === 3 && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setStep(2)} className="p-2 hover:bg-slate-100 rounded-full">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-2xl font-bold">Contact Details</h2>
                </div>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      placeholder="(555) 123-4567"
                    />
                    {form.formState.errors.customerPhone && <p className="text-red-500 text-xs">{form.formState.errors.customerPhone.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Service Address</label>
                    <textarea
                      {...form.register("customerAddress")}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      placeholder="123 Main St, Apt 4B"
                    />
                    {form.formState.errors.customerAddress && <p className="text-red-500 text-xs">{form.formState.errors.customerAddress.message}</p>}
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
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-slate-600 truncate pr-4">{item.name}</span>
                    <span className="font-medium">${item.price}</span>
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
                     <span>{selectedTime}</span>
                   </div>
                 )}
              </div>

              <div className="border-t border-gray-100 pt-4 mt-4 flex justify-between items-center">
                <span className="font-bold text-lg text-slate-900">Total</span>
                <span className="font-bold text-2xl text-primary">${totalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
