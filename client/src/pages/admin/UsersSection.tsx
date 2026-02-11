
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UserDialog } from "./UserDialog";
import type { User as UserType } from "@shared/schema";
import { format } from "date-fns";

export function UsersSection() {
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserType | undefined>(undefined);

    const { data: users, isLoading } = useQuery<UserType[]>({
        queryKey: ["/api/users"],
    });

    const deleteMutation = useMutation({
        mutationFn: async (userId: string) => {
            await apiRequest("DELETE", `/api/users/${userId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            toast({
                title: "User deleted",
                description: "The user has been successfully deleted.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error deleting user",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const handleEdit = (user: UserType) => {
        setSelectedUser(user);
        setIsDialogOpen(true);
    };

    const handleCreate = () => {
        setSelectedUser(undefined);
        setIsDialogOpen(true);
    };

    const handleDelete = (userId: string) => {
        if (confirm("Are you sure you want to delete this user?")) {
            deleteMutation.mutate(userId);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Users</h2>
                    <p className="text-muted-foreground">
                        Manage system users and their permissions.
                    </p>
                </div>
                <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add User
                </Button>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">
                                    No users found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            users?.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                {user.profileImageUrl ? (
                                                    <img src={user.profileImageUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
                                                ) : (
                                                    <User className="w-4 h-4 text-primary" />
                                                )}
                                            </div>
                                            <div>
                                                {user.firstName} {user.lastName}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        <Badge variant={user.isAdmin ? "default" : "secondary"}>
                                            {user.isAdmin ? "Admin" : "User"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {user.createdAt ? format(new Date(user.createdAt), "PPP") : "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEdit(user)}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive/90"
                                                onClick={() => handleDelete(user.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <UserDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                user={selectedUser}
            />
        </div>
    );
}
