import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, Mail, AlertCircle } from "lucide-react";

// Centralized helper: where should each role land after login?
// - platform_owner (ARC Admin MASTER) -> Platform Dashboard (master admin panel)
// - operator_admin -> Operator Management Dashboard
// - driver -> Driver Portal
// - client_user / client_admin -> Solicitar TÃ¡xi screen
//   (client_admin will additionally see a button there to open /portal)
function getHomeRouteForRole(role) {
  if (role === 'platform_owner') return '/platform';
  if (role === 'operator_admin') return '/admin';
  if (role === 'driver') return '/driver';
  if (role === 'client_admin' || role === 'client_user') return '/solicitar';
  return '/login';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, sessionExpired } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Show session expired message if applicable
  useEffect(() => {
    if (sessionExpired) {
      toast.error("Sessão expirada. Por favor, faça login novamente.");
    }
  }, [sessionExpired]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      toast.error("Por favor, preencha todos os campos");
      return;
    }

    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Bem-vindo, ${user.name}!`);
      
      // Check if there was a saved destination (user tried to open a specific
      // page before being asked to log in)
      const from = location.state?.from?.pathname;
      if (from && from !== '/login' && from !== '/') {
        navigate(from, { replace: true });
        return;
      }
      
      // Otherwise redirect to the role-appropriate home screen
      navigate(getHomeRouteForRole(user.role), { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/arc-logo.png"
            alt="ARC Transporte"
            className="h-20 w-auto mx-auto mb-4 drop-shadow-sm"
          />
          <p className="text-slate-500 text-sm mt-1">
            Sistema de Gestão de Transporte
          </p>
        </div>

        {/* Session Expired Warning */}
        {sessionExpired && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              Sua sessão expirou. Por favor, faça login novamente.
            </p>
          </div>
        )}

        <Card className="border-0 shadow-[0_8px_30px_rgba(30,58,95,0.12)]">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-[#1e3a5f]/5 w-12 h-12 rounded-xl flex items-center justify-center mb-2">
              <Lock className="w-6 h-6 text-[#1e3a5f]" />
            </div>
            <CardTitle className="text-xl font-['Manrope'] text-[#1e3a5f]">
              Entrar na Plataforma
            </CardTitle>
            <CardDescription>
              Use suas credenciais para acessar o sistema
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12"
                    data-testid="login-email"
                    autoComplete="email"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12"
                    data-testid="login-password"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 btn-navy text-base font-semibold"
                data-testid="login-submit"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          © 2024 ARC Transporte e locações. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}