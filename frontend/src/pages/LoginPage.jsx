import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, Mail, ArrowLeft, Truck } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Get redirect path from location state, default to appropriate dashboard
  const from = location.state?.from?.pathname || "/dashboard";

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
      
      // Redirect based on role
      if (user.role === 'platform_owner') {
        navigate('/platform');
      } else if (user.role === 'operator_admin') {
        navigate('/admin');
      } else if (user.role === 'driver') {
        navigate('/driver');
      } else {
        navigate('/portal');
      }
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
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1e3a5f] text-white rounded-2xl mb-4 shadow-lg">
            <Truck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-[#1e3a5f] font-['Manrope']">
            Transportation Platform
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Sistema de Gestão de Transporte
          </p>
        </div>

        <Card className="border-0 shadow-[0_8px_30px_rgba(30,58,95,0.12)]">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-[#1e3a5f]/5 w-12 h-12 rounded-xl flex items-center justify-center mb-2">
              <Lock className="w-6 h-6 text-[#1e3a5f]" />
            </div>
            <CardTitle className="text-xl font-['Manrope'] text-[#1e3a5f]">
              Entrar na Plataforma
            </CardTitle>
            <CardDescription>
              Use suas credenciais para acessar
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
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12"
                    data-testid="login-password"
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

            <div className="mt-6 pt-6 border-t border-slate-100">
              <Button
                variant="ghost"
                className="w-full text-slate-500 hover:text-[#1e3a5f]"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para Solicitação de Táxi
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          © 2024 Transportation Platform. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
