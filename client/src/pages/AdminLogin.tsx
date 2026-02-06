import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/context/AuthContext';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock } from 'lucide-react';
import { SiGoogle } from 'react-icons/si';

export default function AdminLogin() {
  const { isAdmin, loading, signIn, isSupabaseAuth } = useAdminAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAdmin) {
      setLocation('/admin');
    }
  }, [loading, isAdmin, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSupabaseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>Sign in to manage your services</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSupabaseAuth ? (
            <form onSubmit={handleSupabaseLogin} className="space-y-4">
              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={submitting}
                data-testid="button-login"
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Sign In
              </Button>
            </form>
          ) : (
            <>
              <p className="text-center text-sm text-muted-foreground">
                Use your Google account to sign in. Only authorized administrators can access this panel.
              </p>
              <Button
                onClick={() => signIn()}
                className="w-full"
                data-testid="button-login"
              >
                <SiGoogle className="w-4 h-4 mr-2" />
                Sign in with Google
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
