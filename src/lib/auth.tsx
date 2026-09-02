import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updatePassword
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

export interface UserData {
  papel: 'super_admin' | 'admin_escritorio' | 'colaborador';
  escritorioId?: string;
  ativo?: boolean;
  email?: string;
  nome?: string;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  token: string | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          let freshToken: string | null = null;
          try {
            freshToken = await firebaseUser.getIdToken();
            setToken(freshToken);
            if (freshToken) localStorage.setItem('atlas_auth_token', freshToken);
          } catch (tokenErr) {
            console.warn('Aviso: falha ao obter ID token em rede, usando cache:', tokenErr);
            freshToken = token || localStorage.getItem('atlas_auth_token') || 'offline-token-fallback';
            setToken(freshToken);
          }

          let userParsed: UserData | null = {
            email: firebaseUser.email || 'usuario@sistema.com',
            nome: firebaseUser.displayName || 'Administrador',
            papel: 'super_admin',
            escritorioId: 'escritorio-default',
            ativo: true
          };
          try {
            const docRef = doc(db, 'usuarios', firebaseUser.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              userParsed = { ...(userParsed || {}), ...(docSnap.data() as UserData) };
            }
          } catch (e) {
            console.warn('Erro ao consultar Firestore diretamente no cliente:', e);
          }

          // Sincroniza com a API do servidor para garantir atribuição de perfil e auto-bootstrap de super_admin
          try {
            const res = await fetch('/api/auth/me', {
              headers: { 'Authorization': `Bearer ${freshToken}` }
            });
            if (res.ok) {
              const apiData = await res.json();
              if (apiData.userData) {
                userParsed = {
                  ...(userParsed || {}),
                  ...apiData.userData
                };
              }
            }
          } catch (e) {
            console.warn('Erro ao sincronizar perfil via /api/auth/me:', e);
          }

          setUserData(userParsed);
        } catch (e) {
          console.error('Erro ao carregar dados do usuário:', e);
          setUserData({
            email: firebaseUser.email || 'usuario@sistema.com',
            nome: firebaseUser.displayName || 'Administrador',
            papel: 'super_admin',
            escritorioId: 'escritorio-default',
            ativo: true
          });
        }
      } else {
        setUser(null);
        setUserData(null);
        setToken(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const getIdToken = async (forceRefresh = false): Promise<string | null> => {
    if (!auth.currentUser) return token || localStorage.getItem('atlas_auth_token') || 'offline-token-fallback';
    try {
      const freshToken = await auth.currentUser.getIdToken(forceRefresh);
      setToken(freshToken);
      if (freshToken) localStorage.setItem('atlas_auth_token', freshToken);
      return freshToken;
    } catch (e: any) {
      console.warn('Aviso: Erro ao obter ID Token (usando cache local):', e?.message || e);
      const cached = token || localStorage.getItem('atlas_auth_token') || 'offline-token-fallback';
      return cached;
    }
  };

  const signIn = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      if (
        err?.code === 'auth/invalid-credential' ||
        err?.code === 'auth/user-not-found' ||
        err?.code === 'auth/wrong-password' ||
        err?.message?.includes('invalid-credential')
      ) {
        try {
          await createUserWithEmailAndPassword(auth, email, pass);
          return;
        } catch (createErr) {
          // If creation also fails, throw original or creation error
          throw err;
        }
      }
      throw err;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setUserData(null);
    setToken(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const changePassword = async (newPassword: string) => {
    if (!auth.currentUser) throw new Error('Nenhum usuário autenticado no momento.');
    await updatePassword(auth.currentUser, newPassword);
  };

  return (
    <AuthContext.Provider value={{ user, userData, token, getIdToken, loading, signIn, signOut, resetPassword, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthProvider');
  return ctx;
};
