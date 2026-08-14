import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Building2, Users, Car, Truck, Plus, Settings, LogOut, LayoutDashboard,
  Loader2, RefreshCw, ChevronRight, Globe, Shield, UserCog, Activity
} from "lucide-react";

export default function PlatformDashboard() {
  const navigate = useNavigate();
  const { user, logout, authAxios, isPlatformOwner } = useAuth();
  
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ operators: 0, companies: 0, trips: 0, drivers: 0 });
  
  // New operator modal
  const [showNewOperator, setShowNewOperator] = useState(false);
  const [newOperatorName, setNewOperatorName] = useState("");
  const [newOperatorEmail, setNewOperatorEmail] = useState("");
  const [newOperatorPhone, setNewOperatorPhone] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [operatorsRes, companiesRes, tripsRes, driversRes] = await Promise.all([
        authAxios.get('/operators'),
        authAxios.get('/companies'),
        authAxios.get('/trips'),
        authAxios.get('/drivers?active_only=false')
      ]);
      
      setOperators(operatorsRes.data);
      setStats({
        operators: operatorsRes.data.length,
        companies: companiesRes.data.length,
        trips: tripsRes.data.length,
        drivers: driversRes.data.length
      });
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [authAxios]);

  useEffect(() => {
    if (!isPlatformOwner) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [isPlatformOwner, navigate, fetchData]);

  const handleCreateOperator = async () => {
    if (!newOperatorName.trim()) {
      toast.error("Nome do operador é obrigatório");
      return;
    }

    setCreating(true);
    try {
      await authAxios.post('/operators', {
        name: newOperatorName,
        trade_name: newOperatorName,
        email: newOperatorEmail,
        phone: newOperatorPhone
      });
      toast.success("Operador criado com sucesso!");
      setShowNewOperator(false);
      setNewOperatorName("");
      setNewOperatorEmail("");
      setNewOperatorPhone("");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao criar operador");
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading && operators.length === 0) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-[#1e3a5f] to-[#2d4a6f] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg font-['Manrope']">Platform Control</h1>
              <p className="text-xs text-white/70">Gestão Multi-Operador</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-white/20 text-white border-0">
              <Shield className="w-3 h-3 mr-1" />
              {user?.name}
            </Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchData}
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Operadores</p>
                <p className="text-3xl font-bold text-blue-700">{stats.operators}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-xl">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600">Empresas Cliente</p>
                <p className="text-3xl font-bold text-emerald-700">{stats.companies}</p>
              </div>
              <div className="bg-emerald-100 p-3 rounded-xl">
                <Users className="w-6 h-6 text-emerald-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600">Total Viagens</p>
                <p className="text-3xl font-bold text-amber-700">{stats.trips}</p>
              </div>
              <div className="bg-amber-100 p-3 rounded-xl">
                <Car className="w-6 h-6 text-amber-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">Motoristas</p>
                <p className="text-3xl font-bold text-purple-700">{stats.drivers}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-xl">
                <Truck className="w-6 h-6 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Operators List */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-['Manrope'] text-[#1e3a5f]">
                Operadores
              </CardTitle>
              <CardDescription>
                Empresas de transporte na plataforma
              </CardDescription>
            </div>
            <Button onClick={() => setShowNewOperator(true)} className="btn-navy">
              <Plus className="w-4 h-4 mr-2" />
              Novo Operador
            </Button>
          </CardHeader>
          <CardContent>
            {operators.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">Nenhum operador cadastrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {operators.map((operator) => (
                  <div
                    key={operator.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                    onClick={() => navigate(`/platform/operator/${operator.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: operator.branding?.primary_color || '#1e3a5f' }}
                      >
                        {operator.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">{operator.name}</h3>
                        <p className="text-sm text-slate-500">
                          {operator.trade_name || operator.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge 
                        className={operator.status === 'active' 
                          ? 'bg-emerald-100 text-emerald-700 border-0' 
                          : 'bg-slate-100 text-slate-600 border-0'
                        }
                      >
                        {operator.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <Card 
            className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/admin-control')}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="bg-[#1e3a5f]/10 p-3 rounded-xl">
                <LayoutDashboard className="w-6 h-6 text-[#1e3a5f]" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">ARC Admin</h3>
                <p className="text-sm text-slate-500">Acessar painel legado</p>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/')}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="bg-emerald-100 p-3 rounded-xl">
                <Car className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Solicitar Táxi</h3>
                <p className="text-sm text-slate-500">Portal de passageiros</p>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/acompanhamento')}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="bg-amber-100 p-3 rounded-xl">
                <Activity className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Acompanhamento</h3>
                <p className="text-sm text-slate-500">Viagens em tempo real</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* New Operator Dialog */}
      <Dialog open={showNewOperator} onOpenChange={setShowNewOperator}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f] flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Novo Operador
            </DialogTitle>
            <DialogDescription>
              Cadastre uma nova empresa de transporte na plataforma
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Operador *</Label>
              <Input
                placeholder="Ex: ABC Transportes"
                value={newOperatorName}
                onChange={(e) => setNewOperatorName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="contato@empresa.com"
                value={newOperatorEmail}
                onChange={(e) => setNewOperatorEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                placeholder="(11) 99999-9999"
                value={newOperatorPhone}
                onChange={(e) => setNewOperatorPhone(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowNewOperator(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateOperator} disabled={creating} className="btn-navy">
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Operador"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
