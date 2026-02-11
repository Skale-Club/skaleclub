
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";
import { Loader2 } from "lucide-react";

const userSchema = z.object({
    email: z.string().email("Invalid email address"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    isAdmin: z.boolean().default(false),
    // Password handling is omitted for basic profile management as per current plan
    // If we need password management, it should be added here
});

type UserFormData = z.infer<typeof userSchema>;

interface UserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user?: User;
}

export function UserDialog({ open, onOpenChange, user }: UserDialogProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const form = useForm<UserFormData>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            email: "",
            firstName: "",
            lastName: "",
            isAdmin: false,
        },
    });

    useEffect(() => {
        if (user) {
            form.reset({
                email: user.email || "",
                firstName: user.firstName || "",
                lastName: user.lastName || "",
                isAdmin: user.isAdmin || false,
            });
        } else {
            form.reset({
                email: "",
                firstName: "",
                lastName: "",
                isAdmin: false,
            });
        }
    }, [user, form, open]);

    const mutation = useMutation({
        mutationFn: async (data: UserFormData) => {
            if (user) {
                // Update
                const res = await apiRequest("PATCH", `/api/users/${user.id}`, data);
                return res.json();
            } else {
                // Create
                const res = await apiRequest("POST", "/api/users", data);
                return res.json();
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            toast({
                title: user ? "User updated" : "User created",
                description: user
                    ? "The user details have been updated."
                    : "The new user has been successfully created.",
            });
            onOpenChange(false);
        },
        onError: (error: any) => {
            toast({
                title: user ? "Error updating user" : "Error creating user",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const onSubmit = (data: UserFormData) => {
        mutation.mutate(data);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{user ? "Edit User" : "Add New User"}</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input placeholder="john.doe@example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="firstName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>First Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="John" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="lastName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Last Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Doe" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="isAdmin"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5">
                                        <FormLabel>Admin Access</FormLabel>
                                        <FormDescription>
                                            Grant full administrative privileges to this user.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending && (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                )}
                                {user ? "Save Changes" : "Create User"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
