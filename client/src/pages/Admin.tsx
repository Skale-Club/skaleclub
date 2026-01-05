import { useBookings } from "@/hooks/use-booking";
import { format } from "date-fns";
import { Calendar, Clock, DollarSign, User, MapPin } from "lucide-react";
import { clsx } from "clsx";

export default function Admin() {
  const { data: bookings, isLoading } = useBookings();

  if (isLoading) return <div className="p-10 text-center">Loading dashboard...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="container-custom mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500">Manage bookings and schedule</p>
        </header>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-bold text-lg">Recent Bookings</h2>
            <span className="text-sm bg-blue-50 text-primary px-3 py-1 rounded-full font-medium">
              {bookings?.length || 0} Total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4 text-left">Customer</th>
                  <th className="px-6 py-4 text-left">Schedule</th>
                  <th className="px-6 py-4 text-left">Service</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bookings?.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{booking.customerName}</p>
                          <p className="text-xs text-slate-500">{booking.customerEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {format(new Date(booking.bookingDate), "MMM dd, yyyy")}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {booking.startTime} - {booking.endTime}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600 flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <span className="truncate max-w-[200px]" title={booking.customerAddress}>
                          {booking.customerAddress}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        "px-2.5 py-1 rounded-full text-xs font-bold",
                        booking.status === "confirmed" ? "bg-green-50 text-green-600" :
                        booking.status === "cancelled" ? "bg-red-50 text-red-600" :
                        "bg-gray-100 text-gray-600"
                      )}>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-bold text-slate-900 flex items-center justify-end gap-1">
                        {booking.paymentMethod === "site" && <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 rounded uppercase">Unpaid</span>}
                        ${booking.totalPrice}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
