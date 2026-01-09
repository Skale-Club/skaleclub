import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type errorSchemas } from "@shared/routes";
import { type InsertBooking, type Category, type Service, type Booking, type Subcategory } from "@shared/schema";
import { z } from "zod";

// --- Categories ---
export function useCategories() {
  return useQuery({
    queryKey: [api.categories.list.path],
    queryFn: async () => {
      const res = await fetch(api.categories.list.path);
      if (!res.ok) throw new Error("Failed to fetch categories");
      return api.categories.list.responses[200].parse(await res.json());
    },
  });
}

// --- Subcategories ---
export function useSubcategories(categoryId?: number) {
  return useQuery<Subcategory[]>({
    queryKey: ['/api/subcategories', categoryId],
    queryFn: async () => {
      const url = categoryId 
        ? `/api/subcategories?categoryId=${categoryId}`
        : '/api/subcategories';
      
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch subcategories");
      return res.json();
    },
  });
}

// --- Services ---
export function useServices(categoryId?: number, subcategoryId?: number) {
  return useQuery({
    queryKey: [api.services.list.path, categoryId, subcategoryId],
    queryFn: async () => {
      let url = api.services.list.path;
      const params = new URLSearchParams();
      if (subcategoryId) params.append('subcategoryId', String(subcategoryId));
      else if (categoryId) params.append('categoryId', String(categoryId));
      
      if (params.toString()) url += `?${params.toString()}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch services");
      return api.services.list.responses[200].parse(await res.json());
    },
    enabled: true, // Always fetch, even if no category (returns all)
  });
}

// --- Availability ---
export function useAvailability(date: string | undefined, totalDurationMinutes: number) {
  return useQuery({
    queryKey: [api.availability.check.path, date, totalDurationMinutes],
    queryFn: async () => {
      if (!date) return [];
      const url = `${api.availability.check.path}?date=${date}&totalDurationMinutes=${totalDurationMinutes}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to check availability");
      return api.availability.check.responses[200].parse(await res.json());
    },
    enabled: !!date && totalDurationMinutes > 0,
  });
}

// --- Monthly Availability ---
export function useMonthAvailability(year: number, month: number, totalDurationMinutes: number) {
  return useQuery({
    queryKey: [api.availability.month.path, year, month, totalDurationMinutes],
    queryFn: async () => {
      const url = `${api.availability.month.path}?year=${year}&month=${month}&totalDurationMinutes=${totalDurationMinutes}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to check monthly availability");
      return api.availability.month.responses[200].parse(await res.json()) as Record<string, boolean>;
    },
    enabled: year > 0 && month > 0 && totalDurationMinutes > 0,
    staleTime: 60000, // Cache for 1 minute
  });
}

// --- Bookings ---
export function useCreateBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (bookingData: InsertBooking) => {
      const res = await fetch(api.bookings.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        // Try to parse as specific error types
        if (res.status === 409) {
          throw new Error("This time slot is no longer available.");
        }
        if (res.status === 400) {
          throw new Error(errorData.message || "Invalid booking data");
        }
        throw new Error("Failed to create booking");
      }
      
      return api.bookings.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.bookings.list.path] });
    },
  });
}

export function useBookings() {
  return useQuery({
    queryKey: [api.bookings.list.path],
    queryFn: async () => {
      const res = await fetch(api.bookings.list.path);
      if (!res.ok) throw new Error("Failed to fetch bookings");
      return api.bookings.list.responses[200].parse(await res.json());
    },
  });
}
