import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2, Users, Car, Truck, Plus, LogOut, LayoutDashboard,
  Loader2, RefreshCw, ChevronRight, Shield, Activity,
  KeyRound, Trash2, Mail, Save, UserPlus, Copy, Eye, EyeOff, Settings
} from "lucide-react";

export default function PlatformDashboard() {
  const navigate = useNavigate();
  const { user, logout, authAxios, isPlatformOwner } = useAuth();

  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ operators: 0, companies: 0, trips: 0, drivers: 0 });

  // ============== New operator modal ==============
  const [showNewOperator, setShowNewOperator] = useState(false);
  const [newOperatorName, setNewOperatorName] = useState("");
  const [newOperatorEmail, setNewOperatorEmail] = useState("");
  const [newOperatorPhone, setNewOperatorPhone] = useState("");
  const [newOperatorPassword, setNewOperatorPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  // ============== Edit operator modal ==============
  const [showEditOperator, setShowEditOperator] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingOperator, setSavingOperator] = useState(false);

  // Credential (login) management for the selected operator
  const [credentialLoading, setCredentialLoading] = useState(false);
  const [operatorUser, setOperatorUser] = useState(null); // existing operator_admin user, or null
  const [credEmail, setCredEmail] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [showCredPassword, setShowCredPassword] = useState(false);
  const [credSaving, setCredSaving] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");

  // Delete credential (login only) confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ============== NEW: Delete ENTIRE operator confirmation ==============
  // This is different from "showDeleteConfirm" above, which only removes the
  // login (operator_admin user) but keeps the operator record itself.
  // This new flow deletes the operator account completely.
  const [showDeleteOperatorConfirm, setShowDeleteOperatorConfirm] = useState(false);
  const [deletingOperator, setDeletingOperator] = useState(false);
  const [cascadeDeleteOperator, setCascadeDeleteOperator] = useState(false);

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

  // ============== Create new operator + login credential ==============
  const handleCreateOperator = async () => {
    if (!newOperatorName.trim()) {
      toast.error("Nome do operador é obrigatório");
      return;
    }
    if (!newOperatorEmail.trim()) {
      toast.error("E-mail é obrigatório para criar o acesso de login");
      return;
    }

    setCreating(true);
    try {
      // 1) Create the operator (company)
      const operatorRes = await authAxios.post('/operators', {
        name: newOperatorName,
        trade_name: newOperatorName,
        email: newOperatorEmail,
        phone: newOperatorPhone
      });

      const newOperator = operatorRes.data;

      // 2) Create the login user (operator_admin) linked to this operator
      const userPayload = {
        email: newOperatorEmail,
        name: newOperatorName,
        role: "operator_admin",
        operator_id: newOperator.id,
        phone: newOperatorPhone
      };
      if (newOperatorPassword.trim()) {
        userPayload.password = newOperatorPassword;
      }

      const userRes = await authAxios.post('/users', userPayload);

      if (userRes.data?.password) {
        toast.success(
          `Operador criado! Senha gerada: ${userRes.data.password} (copie agora, não será mostrada de novo)`,
          { duration: 15000 }
        );
      } else {
        toast.success("Operador e login criados com sucesso!");
      }

      setShowNewOperator(false);
      setNewOperatorName("");
      setNewOperatorEmail("");
      setNewOperatorPhone("");
      setNewOperatorPassword("");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao criar operador");
    } finally {
      setCreating(false);
    }
  };

  // ============== Open edit modal for an operator ==============
  const openEditOperator = async (operator) => {
    setSelectedOperator(operator);
    setEditName(operator.name || "");
    setEditEmail(operator.email || "");
    setEditPhone(operator.phone || "");
    setOperatorUser(null);
    setCredEmail("");
    setCredPassword("");
    setGeneratedPassword("");
    setCascadeDeleteOperator(false);
    setShowEditOperator(true);

    setCredentialLoading(true);
    try {
      const res = await authAxios.get('/users', {
        params: { operator_id: operator.id, role: 'operator_admin' }
      });
      const existing = res.data?.[0] || null;
      setOperatorUser(existing);
      if (existing) {
        setCredEmail(existing.email || "");
      } else {
        setCredEmail(operator.email || "");
      }
    } catch (error) {
      toast.error("Erro ao carregar credenciais do operador");
    } finally {
      setCredentialLoading(false);
    }
  };

  const handleSaveOperator = async () => {
    if (!editName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSavingOperator(true);
    try {
      await authAxios.put(`/operators/${selectedOperator.id}`, {
        name: editName,
        trade_name: editName,
        email: editEmail,
        phone: editPhone
      });
      toast.success("Operador atualizado com sucesso!");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao atualizar operador");
    } finally {
      setSavingOperator(false);
    }
  };

  // ============== Create login credential (if none exists) ==============
  const handleCreateCredential = async () => {
    if (!credEmail.trim()) {
      toast.error("Informe um e-mail para o login");
      return;
    }
    setCredSaving(true);
    try {
      const payload = {
        email: credEmail,
        name: editName || selectedOperator.name,
        role: "operator_admin",
        operator_id: selectedOperator.id
      };
      if (credPassword.trim()) {
        payload.password = credPassword;
      }
      const res = await authAxios.post('/users', payload);
      if (res.data?.password) {
        setGeneratedPassword(res.data.password);
        toast.success("Credencial criada! Copie a senha antes de fechar.");
      } else {
        toast.success("Credencial criada com sucesso!");
      }
      // Refresh the operator user
      const listRes = await authAxios.get('/users', {
        params: { operator_id: selectedOperator.id, role: 'operator_admin' }
      });
      setOperatorUser(listRes.data?.[0] || null);
      setCredPassword("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao criar credencial");
    } finally {
      setCredSaving(false);
    }
  };

  // ============== Update existing user's e-mail ==============
  const handleUpdateCredentialEmail = async () => {
    if (!operatorUser) return;
    if (!credEmail.trim()) {
      toast.error("E-mail não pode ficar vazio");
      return;
    }
    setCredSaving(true);
    try {
      await authAxios.put(`/users/${operatorUser.id}`, { email: credEmail });
      toast.success("E-mail de acesso atualizado!");
      setOperatorUser({ ...operatorUser, email: credEmail });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao atualizar e-mail");
    } finally {
      setCredSaving(false);
    }
  };

  // ============== Reset password of existing user ==============
  const handleResetPassword = async () => {
    if (!operatorUser) return;
    setCredSaving(true);
    try {
      const payload = credPassword.trim() ? { new_password: credPassword } : {};
      const res = await authAxios.post(`/users/${operatorUser.id}/reset-password`, payload);
      if (res.data?.password) {
        setGeneratedPassword(res.data.password);
      }
      toast.success("Senha redefinida com sucesso!");
      setCredPassword("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao redefinir senha");
    } finally {
      setCredSaving(false);
    }
  };

  // ============== Delete existing user (login access ONLY) ==============
  const handleDeleteCredential = async () => {
    if (!operatorUser) return;
    setDeleting(true);
    try {
      await authAxios.delete(`/users/${operatorUser.id}`, { params: { confirm: true } });
      toast.success("Acesso removido com sucesso!");
      setOperatorUser(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao remover acesso");
    } finally {
      setDeleting(false);
    }
  };

  // ============== NEW: Delete the ENTIRE operator (account + login) ==============
  // Unlike handleDeleteCredential (which only removes the login), this
  // permanently deletes the operator record itself via DELETE /operators/{id}.
  // If "cascadeDeleteOperator" is checked, all linked data (client companies,
  // passengers, drivers, vehicles, trips) is deleted too. Otherwise that data
  // is preserved in the database, just without an operator reference.
  const handleDeleteOperator = async () => {
    if (!selectedOperator) return;
    setDeletingOperator(true);
    try {
      const res = await authAxios.delete(`/operators/${selectedOperator.id}`, {
        params: { confirm: true, cascade: cascadeDeleteOperator }
      });
      toast.success(res.data?.message || "Operador excluído com sucesso!");
      setShowDeleteOperatorConfirm(false);
      setShowEditOperator(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao excluir operador");
    } finally {
      setDeletingOperator(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
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
            <div className="bg-white/95 px-3 py-1.5 rounded-lg shadow-sm">
              <img src="/arc-logo.png" alt="ARC Transporte" className="h-7 w-auto" />
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
                    onClick={() => openEditOperator(operator)}
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <Card
            className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/admin')}
            data-testid="shortcut-gestao-arc"
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="bg-indigo-100 p-3 rounded-xl">
                <Settings className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Gestão ARC</h3>
                <p className="text-sm text-slate-500">Empresas, passageiros e usuários</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/admin-control')}
            data-testid="shortcut-arc-admin-legado"
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
            onClick={() => navigate('/solicitar')}
            data-testid="shortcut-solicitar-taxi"
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
            data-testid="shortcut-acompanhamento"
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

      {/* ============== New Operator Dialog ============== */}
      <Dialog open={showNewOperator} onOpenChange={setShowNewOperator}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f] flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Novo Operador
            </DialogTitle>
            <DialogDescription>
              Cadastre uma nova empresa de transporte na plataforma. Um login de acesso será criado automaticamente.
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
              <Label>E-mail de login *</Label>
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
            <div className="space-y-2">
              <Label>Senha de acesso (deixe em branco para gerar automaticamente)</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Senha para o operador entrar no sistema"
                  value={newOperatorPassword}
                  onChange={(e) => setNewOperatorPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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

      {/* ============== Edit Operator Dialog ============== */}
      <Dialog open={showEditOperator} onOpenChange={setShowEditOperator}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f] flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {selectedOperator?.name}
            </DialogTitle>
            <DialogDescription>
              Edite os dados do operador e gerencie o acesso de login.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Operator basic data */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Dados do Operador</h4>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>E-mail de contato</Label>
                <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>
              <Button
                onClick={handleSaveOperator}
                disabled={savingOperator}
                className="btn-navy w-full"
              >
                {savingOperator ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar Dados
              </Button>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Acesso de Login (operator_admin)
              </h4>

              {credentialLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : operatorUser ? (
                <div className="space-y-3">
                  <Badge className="bg-emerald-100 text-emerald-700 border-0">
                    Acesso ativo — {operatorUser.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>

                  <div className="space-y-2">
                    <Label>E-mail de login</Label>
                    <div className="flex gap-2">
                      <Input value={credEmail} onChange={(e) => setCredEmail(e.target.value)} />
                      <Button variant="outline" onClick={handleUpdateCredentialEmail} disabled={credSaving}>
                        <Mail className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Nova senha (deixe em branco para gerar automaticamente)</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showCredPassword ? "text" : "password"}
                          value={credPassword}
                          onChange={(e) => setCredPassword(e.target.value)}
                          placeholder="Nova senha"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                          onClick={() => setShowCredPassword(!showCredPassword)}
                        >
                          {showCredPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <Button variant="outline" onClick={handleResetPassword} disabled={credSaving}>
                        <KeyRound className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {generatedPassword && (
                    <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <span className="text-sm font-mono text-amber-800">{generatedPassword}</span>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(generatedPassword)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remover Acesso / Excluir Login
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">
                    Este operador ainda não possui um login criado.
                  </p>
                  <div className="space-y-2">
                    <Label>E-mail de login</Label>
                    <Input
                      type="email"
                      value={credEmail}
                      onChange={(e) => setCredEmail(e.target.value)}
                      placeholder="email@operador.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha (deixe em branco para gerar automaticamente)</Label>
                    <div className="relative">
                      <Input
                        type={showCredPassword ? "text" : "password"}
                        value={credPassword}
                        onChange={(e) => setCredPassword(e.target.value)}
                        placeholder="Senha de acesso"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        onClick={() => setShowCredPassword(!showCredPassword)}
                      >
                        {showCredPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button onClick={handleCreateCredential} disabled={credSaving} className="btn-navy w-full">
                    {credSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4 mr-2" />
                    )}
                    Criar Credencial
                  </Button>
                </div>
              )}
            </div>

            {/* ============== NEW: Delete entire operator section ============== */}
            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-semibold text-red-600 uppercase tracking-wide flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Zona de Risco
              </h4>
              <p className="text-sm text-slate-500">
                Isso exclui o operador (empresa de transporte) e todos os logins vinculados a ele
                permanentemente — não apenas o acesso, a conta inteira do operador.
              </p>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  setCascadeDeleteOperator(false);
                  setShowDeleteOperatorConfirm(true);
                }}
                data-testid="delete-operator-btn"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir Operador Permanentemente
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditOperator(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============== Delete credential (login only) confirmation ============== */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso deste operador?</AlertDialogTitle>
            <AlertDialogDescription>
              O login de acesso (operator_admin) será excluído. O operador em si e seus
              dados históricos (empresas, viagens, motoristas) não serão apagados — apenas
              este login deixará de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCredential} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============== NEW: Delete ENTIRE operator confirmation ============== */}
      <AlertDialog open={showDeleteOperatorConfirm} onOpenChange={setShowDeleteOperatorConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir operador permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação exclui o operador <strong>{selectedOperator?.name}</strong> e todos os
              logins de acesso vinculados a ele (operator_admin e demais usuários com esse
              operator_id). Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-start gap-2 py-2 px-1">
            <input
              type="checkbox"
              id="cascade-delete-operator"
              checked={cascadeDeleteOperator}
              onChange={(e) => setCascadeDeleteOperator(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="cascade-delete-operator" className="text-sm text-slate-600">
              Também excluir todos os dados vinculados a este operador (empresas clientes,
              passageiros, motoristas, veículos e histórico de viagens). Se deixar
              desmarcado, esses dados permanecem no banco, sem operador associado.
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOperator}
              disabled={deletingOperator}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingOperator ? <Loader2 className="w-4 h-4 animate-spin" /> : "Excluir Permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}