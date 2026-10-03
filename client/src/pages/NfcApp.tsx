import { useEffect, type ReactNode } from 'react';
import { Redirect, Route, Switch, useLocation } from 'wouter';
import { useAdminAuth } from '@/context/AuthContext';
import { AppLoader } from '@/components/ui/spinner';
import { AppLockGate, DevicesScreen, NfcLogin, TrustedDeviceSync } from '@/components/nfc-app/auth';
import HomeScreen from '@/components/nfc-app/HomeScreen';
import TagScreen from '@/components/nfc-app/TagScreen';
import DirectScreen from '@/components/nfc-app/DirectScreen';
import NewTagScreen from '@/components/nfc-app/NewTagScreen';
import { useAppManifest } from '@/components/nfc-app/lib';

function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAdminAuth();
  const [location] = useLocation();

  if (loading) return <AppLoader />;
  if (!isAdmin) {
    const next = location + window.location.search;
    return <Redirect to={`/nfc/login?next=${encodeURIComponent(next)}`} />;
  }
  return (
    <AppLockGate>
      <TrustedDeviceSync />
      {children}
    </AppLockGate>
  );
}

export default function NfcApp() {
  useAppManifest();
  const [, navigate] = useLocation();

  // Keep the installed app inside its scope when the bare /nfc/ is opened.
  useEffect(() => {
    if (window.location.pathname.replace(/\/+$/, '') === '/nfc') navigate('/nfc/home', { replace: true });
  }, [navigate]);

  return (
    <Switch>
      <Route path="/nfc/login" component={NfcLogin} />
      <Route path="/nfc/home">
        <RequireAdmin>
          <HomeScreen />
        </RequireAdmin>
      </Route>
      <Route path="/nfc/t/:code">
        {(params) => (
          <RequireAdmin>
            <TagScreen key={params.code} code={decodeURIComponent(params.code)} />
          </RequireAdmin>
        )}
      </Route>
      <Route path="/nfc/direct">
        <RequireAdmin>
          <DirectScreen />
        </RequireAdmin>
      </Route>
      <Route path="/nfc/new">
        <RequireAdmin>
          <NewTagScreen />
        </RequireAdmin>
      </Route>
      <Route path="/nfc/devices">
        <RequireAdmin>
          <DevicesScreen />
        </RequireAdmin>
      </Route>
      <Route>
        <Redirect to="/nfc/home" />
      </Route>
    </Switch>
  );
}
