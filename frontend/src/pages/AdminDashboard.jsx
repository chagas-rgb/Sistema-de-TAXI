import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Car, 
  Lock,
  LogOut,
  Clock,
  CheckCircle2,
  Flag,
  Users,
  MapPin,
  Loader2,
  AlertCircle,
  RefreshCw,
  LayoutDashboard,
  Bell
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  aguardando: {
    label: "Aguardando",
    icon: Clock,
    className: "status-aguardando",
    borderColor: "border-l-amber-400"
  },
  confirmado: {
    label: "Confirmado",
    icon: Car,
    className: "status-confirmado",
    borderColor: "border-l-emerald-500"
  },
  finalizado: {
    label: "Finalizado",
    icon: CheckCircle2,
    className: "status-finalizado",
    borderColor: "border-l-slate-400"
  },
  cancelado: {
    label: "Cancelado",
    icon: AlertCircle,
    className: "status-cancelado",
    borderColor: "border-l-red-400"
  }
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("active"); // active, all
  const audioRef = useRef(null);
  const previousRequestCount = useRef(0);

  // Fetch requests
  const fetchRequests = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API}/requests`);
      const allRequests = response.data;
      
      // Check for new requests to play sound
      const pendingRequests = allRequests.filter(r => r.status === "aguardando");
      if (pendingRequests.length > previousRequestCount.current && previousRequestCount.current > 0) {
        playNotificationSound();
        toast.info("Nova solicitação recebida!", {
          icon: <Bell className="w-4 h-4" />
        });
      }
      previousRequestCount.current = pendingRequests.length;
      
      setRequests(allRequests);
    } catch (error) {
      toast.error("Erro ao carregar solicitações");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Play notification sound
  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Browser may block autoplay
      });
    }
  };

  // Verify password
  const handleLogin = async (e) => {
    e.preventDefault();
    setVerifying(true);
    
    try {
      await axios.post(`${API}/admin/verify`, { password });
      setIsAuthenticated(true);
      toast.success("Acesso autorizado");
    } catch (error) {
      toast.error("Senha incorreta");
    } finally {
      setVerifying(false);
    }
  };

  // Update request status
  const updateStatus = async (requestId, newStatus) => {
    try {
      await axios.put(`${API}/requests/${requestId}/status`, { status: newStatus });
      toast.success(`Status atualizado para: ${STATUS_CONFIG[newStatus].label}`);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao atualizar status");
    }
  };

  // Setup SSE and initial fetch
  useEffect(() => {
    if (!isAuthenticated) return;
    
    fetchRequests();
    
    // SSE for real-time updates
    const eventSource = new EventSource(`${API}/requests/stream/events`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_request") {
          playNotificationSound();
          toast.info("Nova solicitação recebida!", {
            icon: <Bell className="w-4 h-4" />
          });
          fetchRequests();
        } else if (data.type === "status_update") {
          fetchRequests();
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    // Polling as backup every 10 seconds
    const interval = setInterval(fetchRequests, 10000);

    return () => {
      eventSource.close();
      clearInterval(interval);
    };
  }, [isAuthenticated, fetchRequests]);

  // Logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword("");
    setRequests([]);
  };

  // Filter requests
  const filteredRequests = requests.filter(req => {
    if (filter === "active") {
      return req.status === "aguardando" || req.status === "confirmado";
    }
    return true;
  });

  // Stats
  const stats = {
    aguardando: requests.filter(r => r.status === "aguardando").length,
    confirmado: requests.filter(r => r.status === "confirmado").length,
    finalizado: requests.filter(r => r.status === "finalizado").length
  };

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        {/* Hidden audio element for notification sound */}
        <audio ref={audioRef} preload="auto">
          <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQsVKo7c77+FSg0AJI7d+M2ZVyEZMpHk+cuNXSgcLI7g98B+VykeMJPj98R/VScaMYzi98B5TxsbNo7h9rxvQhUZOJHj9rlpPRQWOI7e9LJfNA8TMo3c8qpZLw0TL4nY76FTKw0SLYbU7JlNJQsRKoPS6JNHIAkQKH/P5IxCGwgOJXvL4IU8FgYNI3bH3H42EgYMIHHD2Hc0EAULHm2/1XEuDQQKG2q70W0pCQMJGWa3zWklBwIIF2O0yWUiBgEHFV+wxGEfBAEGE1yswV0cAgAFEVmorFoZAQAED1WlqFYWAAADDlKiplMUAAACC0+fpFARAAABC0ycok0PAAABCUWZN0sMAAAACEOXNEkLAAAABz+UMEYJ" type="audio/wav" />
        </audio>
        
        <Card className="w-full max-w-md border-0 shadow-[0_8px_30px_rgba(30,58,95,0.15)] animate-fade-in-up">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-[#1e3a5f] text-white w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
              <Lock className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <CardTitle className="text-2xl font-['Manrope'] text-[#1e3a5f]">
              ARC Control
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Painel Administrativo
            </p>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="password" className="text-slate-700">
                  Senha de Acesso
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite a senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 h-12"
                  data-testid="admin-password-input"
                />
              </div>
              
              <Button
                type="submit"
                disabled={verifying || !password}
                className="w-full h-12 btn-navy"
                data-testid="admin-login-btn"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="text-slate-500"
                data-testid="back-to-home"
              >
                Voltar para página inicial
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Hidden audio element for notification sound */}
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQsVKo7c77+FSg0AJI7d+M2ZVyEZMpHk+cuNXSgcLI7g98B+VykeMJPj98R/VScaMYzi98B5TxsbNo7h9rxvQhUZOJHj9rlpPRQWOI7e9LJfNA8TMo3c8qpZLw0TL4nY76FTKw0SLYbU7JlNJQsRKoPS6JNHIAkQKH/P5IxCGwgOJXvL4IU8FgYNI3bH3H42EgYMIHHD2Hc0EAULHm2/1XEuDQQKG2q70W0pCQMJGWa3zWklBwIIF2O0yWUiBgEHFV+wxGEfBAEGE1yswV0cAgAFEVmorFoZAQAED1WlqFYWAAADDlKiplMUAAACC0+fpFARAAABC0ycok0PAAABCUWZN0sMAAAACEOXNEkLAAAABz+UMEYJ" type="audio/wav" />
      </audio>
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#1e3a5f] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
              <LayoutDashboard className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight font-['Manrope']">ARC Control</h1>
              <p className="text-xs text-white/70">Painel Administrativo</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchRequests}
              className="text-white/80 hover:text-white hover:bg-white/10"
              data-testid="refresh-requests"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white/80 hover:text-white hover:bg-white/10"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-medium">Aguardando</p>
                <p className="text-3xl font-bold text-amber-700" data-testid="stat-aguardando">
                  {stats.aguardando}
                </p>
              </div>
              <div className="bg-amber-100 p-3 rounded-xl">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 font-medium">Em Andamento</p>
                <p className="text-3xl font-bold text-emerald-700" data-testid="stat-confirmado">
                  {stats.confirmado}
                </p>
              </div>
              <div className="bg-emerald-100 p-3 rounded-xl">
                <Car className="w-6 h-6 text-emerald-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Finalizados Hoje</p>
                <p className="text-3xl font-bold text-slate-700" data-testid="stat-finalizado">
                  {stats.finalizado}
                </p>
              </div>
              <div className="bg-slate-100 p-3 rounded-xl">
                <Flag className="w-6 h-6 text-slate-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={filter === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("active")}
            className={filter === "active" ? "btn-navy" : ""}
            data-testid="filter-active"
          >
            Ativos
          </Button>
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            className={filter === "all" ? "btn-navy" : ""}
            data-testid="filter-all"
          >
            Todos
          </Button>
        </div>

        {/* Requests List */}
        {loading && requests.length === 0 ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#1e3a5f]" />
            <p className="mt-2 text-slate-500">Carregando solicitações...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <Car className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">Nenhuma solicitação {filter === "active" ? "ativa" : ""}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => {
              const statusConfig = STATUS_CONFIG[request.status];
              const StatusIcon = statusConfig.icon;
              const allPassengers = [request.main_passenger, ...request.additional_passengers];
              
              return (
                <Card 
                  key={request.id}
                  className={`border-0 shadow-sm border-l-4 ${statusConfig.borderColor} ${
                    request.status === 'aguardando' ? 'new-request-pulse' : ''
                  }`}
                  data-testid={`request-card-${request.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      {/* Request Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <Badge className={`${statusConfig.className} text-xs`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            ID: {request.id.slice(0, 8)}
                          </span>
                        </div>
                        
                        {/* Passengers */}
                        <div className="mb-3">
                          <div className="flex items-center gap-1 text-sm text-slate-600 mb-2">
                            <Users className="w-4 h-4" />
                            <span className="font-medium">
                              {allPassengers.length} passageiro{allPassengers.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="space-y-1 pl-5">
                            {allPassengers.map((p, idx) => (
                              <div key={idx} className="text-sm">
                                <span className="font-medium text-slate-800">{p.full_name}</span>
                                <span className="text-slate-400 ml-2">({p.matricula})</span>
                                {idx === 0 && (
                                  <Badge variant="secondary" className="ml-2 text-xs py-0">
                                    Principal
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Destination */}
                        <div className="flex items-start gap-1 text-sm text-slate-600">
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>{request.destination_address}</span>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex flex-col gap-2 md:min-w-[160px]">
                        {request.status === "aguardando" && (
                          <Button
                            onClick={() => updateStatus(request.id, "confirmado")}
                            className="btn-navy text-sm"
                            data-testid={`confirm-btn-${request.id}`}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Confirmar Táxi
                          </Button>
                        )}
                        
                        {request.status === "confirmado" && (
                          <Button
                            onClick={() => updateStatus(request.id, "finalizado")}
                            variant="outline"
                            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            data-testid={`finish-btn-${request.id}`}
                          >
                            <Flag className="w-4 h-4 mr-1" />
                            Finalizar Corrida
                          </Button>
                        )}
                        
                        {(request.status === "finalizado" || request.status === "cancelado") && (
                          <span className="text-xs text-slate-400 text-center">
                            {new Date(request.updated_at).toLocaleString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
