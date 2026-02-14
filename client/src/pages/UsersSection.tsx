import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Pencil, Trash2, Check, Users, Upload } from 'lucide-react';

async function uploadFileToServer(file: File): Promise<string> {
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ filename: file.name, data: base64Data }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Upload failed');
  }

  const { path } = await res.json();
  return path;
}

// User type for the users section
interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string;
  isAdmin: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
}

export function UsersSection() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserData | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    firstName: '',
    lastName: '',
    isAdmin: false,
  });

  const { data: users, isLoading } = useQuery<UserData[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users');
      return res.json();
    }
  });

  const updateUser = useMutation({
    mutationFn: async (data: { id: string; isAdmin?: boolean; firstName?: string; lastName?: string; profileImageUrl?: string }) => {
      const { id, ...body } = data;
      const res = await apiRequest('PATCH', `/api/users/${id}`, body);
      return res.json();
    },
    onSuccess: (updatedUser: Partial<UserData> & { id: string }) => {
      queryClient.setQueryData<UserData[]>(['/api/users'], (currentUsers) => {
        if (!currentUsers) return currentUsers;
        return currentUsers.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: 'User updated successfully' });
      setEditingUser(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating user',
        description: error?.message || 'Please try again',
        variant: 'destructive'
      });
    }
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/users/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: 'User deleted successfully' });
      setDeletingUser(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error deleting user',
        description: error?.message || 'Please try again',
        variant: 'destructive'
      });
    }
  });

  const createUser = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const res = await apiRequest('POST', '/api/users', userData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: 'User created successfully' });
      setIsAddDialogOpen(false);
      setNewUser({ email: '', firstName: '', lastName: '', isAdmin: false });
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating user',
        description: error?.message || 'Please try again',
        variant: 'destructive'
      });
    }
  });

  const getDisplayName = (user: UserData) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName} ${user.lastName}`.trim();
    }
    return 'Unnamed User';
  };

  const getInitials = (user: UserData) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  const handleSaveUser = () => {
    if (!editingUser) return;

    updateUser.mutate({
      id: editingUser.id,
      isAdmin: Boolean(editingUser.isAdmin),
      firstName: editingUser.firstName ?? '',
      lastName: editingUser.lastName ?? '',
      profileImageUrl: editingUser.profileImageUrl ?? '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Users</h2>
          <p className="text-muted-foreground">Manage user accounts and permissions</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="isAdmin"
                  checked={newUser.isAdmin}
                  onCheckedChange={(checked) => setNewUser({ ...newUser, isAdmin: checked as boolean })}
                />
                <Label htmlFor="isAdmin" className="cursor-pointer">Grant admin privileges</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createUser.mutate(newUser)}
                disabled={!newUser.email || createUser.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createUser.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Add User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Users Table */}
      <Card className="border-0 shadow-none">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !users || users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Users className="w-12 h-12 mb-4 opacity-40" />
              <p>No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-6 py-4 font-medium text-muted-foreground">User</th>
                    <th className="text-left px-6 py-4 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-6 py-4 font-medium text-muted-foreground">Role</th>
                    <th className="text-right px-6 py-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {user.profileImageUrl ? (
                            <img
                              src={user.profileImageUrl}
                              alt={getDisplayName(user)}
                              className="w-10 h-10 rounded-full object-cover"
                              crossOrigin="anonymous"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium">
                              {getInitials(user)}
                            </div>
                          )}
                          <span className="font-medium">{getDisplayName(user)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{user.email}</td>
                      <td className="px-6 py-4">
                        {user.isAdmin ? (
                          <Badge className="bg-blue-600 hover:bg-blue-700 text-white">Admin</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-400 hover:bg-yellow-500 text-black">User</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Dialog open={editingUser?.id === user.id} onOpenChange={(open) => !open && setEditingUser(null)}>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingUser(user)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit User</DialogTitle>
                              </DialogHeader>
                              <div className="py-4 space-y-4">
                                <div className="flex items-center gap-3">
                                  <div className="relative group cursor-pointer" onClick={() => avatarFileInputRef.current?.click()}>
                                    {editingUser?.profileImageUrl ? (
                                      <img
                                        src={editingUser.profileImageUrl}
                                        alt={getDisplayName(editingUser)}
                                        className="w-16 h-16 rounded-full object-cover"
                                        crossOrigin="anonymous"
                                      />
                                    ) : (
                                      <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium text-xl">
                                        {editingUser ? getInitials(editingUser) : ''}
                                      </div>
                                    )}
                                    <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      {isUploadingAvatar ? (
                                        <Loader2 className="w-5 h-5 animate-spin text-white" />
                                      ) : (
                                        <Upload className="w-5 h-5 text-white" />
                                      )}
                                    </div>
                                    <input
                                      ref={avatarFileInputRef}
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file || !editingUser) return;
                                        setIsUploadingAvatar(true);
                                        try {
                                          const path = await uploadFileToServer(file);
                                          setEditingUser(prev => prev ? { ...prev, profileImageUrl: path } : null);
                                          toast({ title: 'Avatar uploaded' });
                                        } catch (error: any) {
                                          toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
                                        } finally {
                                          setIsUploadingAvatar(false);
                                          if (avatarFileInputRef.current) avatarFileInputRef.current.value = '';
                                        }
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <p className="font-medium">{editingUser ? getDisplayName(editingUser) : ''}</p>
                                    <p className="text-sm text-muted-foreground">{user.email}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor="edit-firstName">First Name</Label>
                                    <Input
                                      id="edit-firstName"
                                      value={editingUser?.firstName || ''}
                                      onChange={(e) => setEditingUser(prev => prev ? { ...prev, firstName: e.target.value } : null)}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="edit-lastName">Last Name</Label>
                                    <Input
                                      id="edit-lastName"
                                      value={editingUser?.lastName || ''}
                                      onChange={(e) => setEditingUser(prev => prev ? { ...prev, lastName: e.target.value } : null)}
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`edit-isAdmin-${user.id}`}
                                    checked={editingUser?.isAdmin ?? user.isAdmin}
                                    onCheckedChange={(checked) => 
                                      setEditingUser(prev => prev ? { ...prev, isAdmin: checked as boolean } : null)
                                    }
                                  />
                                  <Label htmlFor={`edit-isAdmin-${user.id}`} className="cursor-pointer">
                                    Admin privileges
                                  </Label>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  onClick={handleSaveUser}
                                  disabled={updateUser.isPending}
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  {updateUser.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <Check className="w-4 h-4 mr-2" />
                                  )}
                                  Save Changes
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          <AlertDialog open={deletingUser?.id === user.id} onOpenChange={(open) => !open && setDeletingUser(null)}>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeletingUser(user)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete <strong>{getDisplayName(user)}</strong> ({user.email})?
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setDeletingUser(null)}>
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUser.mutate(user.id)}
                                  disabled={deleteUser.isPending}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {deleteUser.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4 mr-2" />
                                  )}
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
