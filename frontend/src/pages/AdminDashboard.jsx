import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Car, Lock, LogOut, Clock, CheckCircle2, Flag, Users, MapPin, Loader2,
  AlertCircle, RefreshCw, LayoutDashboard, Bell, Phone, User, Upload,
  FileSpreadsheet, Download, CalendarIcon, Building, Navigation, Edit2,
  UserCog, Truck
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  aguardando: { label: "Aguardando", icon: Clock, className: "status-aguardando", borderColor: "border-l-amber-400" },
  confirmado: { label: "Confirmado", icon: Car, className: "status-confirmado", borderColor: "border-l-emerald-500" },
  finalizado: { label: "Finalizado", icon: CheckCircle2, className: "status-finalizado", borderColor: "border-l-slate-400" },
  cancelado: { label: "Cancelado", icon: AlertCircle, className: "status-cancelado", borderColor: "border-l-red-400" }
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState("requests");
  
  // Requests
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("active");
  const [typeFilter, setTypeFilter] = useState("all");
  
  // Drivers
  const [drivers, setDrivers] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  
  // History
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  
  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState("employees"); // employees or drivers
  const [uploading, setUploading] = useState(false);
  const [replaceAll, setReplaceAll] = useState(false);
  const fileInputRef = useRef(null);
  
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [customDriverName, setCustomDriverName] = useState("");
  const [customDriverPhone, setCustomDriverPhone] = useState("");
  const [assigningDriver, setAssigningDriver] = useState(false);
  
  const [editScheduleOpen, setEditScheduleOpen] = useState(false);
  const [editDate, setEditDate] = useState(null);
  const [editTime, setEditTime] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);
  
  const audioRef = useRef(null);
  const previousRequestCount = useRef(0);

  // Fetch requests
  const fetchRequests = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API}/requests`);
      const allRequests = response.data;
      const pendingRequests = allRequests.filter(r => r.status === "aguardando");
      if (pendingRequests.length > previousRequestCount.current && previousRequestCount.current > 0) {
        playNotificationSound();
        toast.info("Nova solicitação recebida!");
      }
      previousRequestCount.current = pendingRequests.length;
      setRequests(allRequests);
    } catch (error) {
      toast.error("Erro ao carregar solicitações");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch drivers
  const fetchDrivers = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingDrivers(true);
    try {
      const response = await axios.get(`${API}/drivers`);
      setDrivers(response.data);
    } catch (error) {
      toast.error("Erro ao carregar motoristas");
    } finally {
      setLoadingDrivers(false);
    }
  }, [isAuthenticated]);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    if (!isAuthenticated) return;
    setHistoryLoading(true);
    try {
      let url = `${API}/requests/history`;
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", format(startDate, "yyyy-MM-dd"));
      if (endDate) params.append("end_date", format(endDate, "yyyy-MM-dd"));
      if (params.toString()) url += `?${params.toString()}`;
      const response = await axios.get(url);
      setHistoryData(response.data);
    } catch (error) {
      toast.error("Erro ao carregar histórico");
    } finally {
      setHistoryLoading(false);
    }
  }, [isAuthenticated, startDate, endDate]);

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

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

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword("");
    setRequests([]);
  };

  // Update status
  const updateStatus = async (requestId, newStatus) => {
    try {
      await axios.put(`${API}/requests/${requestId}/status`, { status: newStatus });
      toast.success(`Status atualizado: ${STATUS_CONFIG[newStatus].label}`);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao atualizar");
    }
  };

  // Open driver assignment modal
  const openDriverModal = (request) => {
    setSelectedRequest(request);
    setSelectedDriverId(request.driver_id || "");
    setCustomDriverName(request.driver_name || "");
    setCustomDriverPhone(request.driver_phone || "");
    setDriverModalOpen(true);
  };

  // Assign driver
  const handleAssignDriver = async () => {
    let driverName = customDriverName;
    let driverPhone = customDriverPhone;
    let driverId = "";
    
    if (selectedDriverId && selectedDriverId !== "outro") {
      const driver = drivers.find(d => d.id === selectedDriverId);
      if (driver) {
        driverName = driver.name;
        driverPhone = driver.phone;
        driverId = driver.id;
      }
    }
    
    if (!driverName.trim()) {
      toast.error("Por favor, informe o nome do motorista");
      return;
    }
    
    setAssigningDriver(true);
    try {
      await axios.put(`${API}/requests/${selectedRequest.id}/assign-driver`, {
        driver_id: driverId,
        driver_name: driverName,
        driver_phone: driverPhone
      });
      
      // Also update status to confirmado if still aguardando
      if (selectedRequest.status === "aguardando") {
        await axios.put(`${API}/requests/${selectedRequest.id}/status`, { status: "confirmado" });
      }
      
      toast.success("Motorista designado com sucesso");
      setDriverModalOpen(false);
      fetchRequests();
    } catch (error) {
      toast.error("Erro ao designar motorista");
    } finally {
      setAssigningDriver(false);
    }
  };

  // Edit schedule
  const openEditSchedule = (request) => {
    setSelectedRequest(request);
    if (request.scheduled_date) {
      try { setEditDate(parseISO(request.scheduled_date)); } catch { setEditDate(null); }
    }
    setEditTime(request.scheduled_time || "");
    setEditScheduleOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!editDate || !editTime) {
      toast.error("Selecione data e horário");
      return;
    }
    setSavingSchedule(true);
    try {
      await axios.put(`${API}/requests/${selectedRequest.id}/schedule`, {
        scheduled_date: format(editDate, "yyyy-MM-dd"),
        scheduled_time: editTime
      });
      toast.success("Agendamento atualizado");
      setEditScheduleOpen(false);
      fetchRequests();
    } catch (error) {
      toast.error("Erro ao atualizar agendamento");
    } finally {
      setSavingSchedule(false);
    }
  };

  // CSV Upload
  const handleCSVUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const endpoint = uploadType === "drivers" 
        ? `${API}/drivers/upload-csv?replace=${replaceAll}`
        : `${API}/employees/upload-csv?replace=${replaceAll}`;
      
      const response = await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(response.data.message);
      setUploadModalOpen(false);
      setReplaceAll(false);
      if (uploadType === "drivers") fetchDrivers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao importar CSV");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Export CSV
  const handleExportCSV = async () => {
    try {
      let url = `${API}/requests/export-csv`;
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", format(startDate, "yyyy-MM-dd"));
      if (endDate) params.append("end_date", format(endDate, "yyyy-MM-dd"));
      if (params.toString()) url += `?${params.toString()}`;
      
      window.open(url, '_blank');
      toast.success("Exportação iniciada");
    } catch (error) {
      toast.error("Erro ao exportar");
    }
  };

  // Download templates
  const downloadTemplate = (type) => {
    const templates = {
      employees: "matricula,name,address,phone\n101,João Silva,Rua A 123,(11) 99999-1001",
      drivers: "name,phone\nRoberto Motorista,(11) 98888-0001"
    };
    const blob = new Blob([templates[type]], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchRequests();
      fetchDrivers();
      const eventSource = new EventSource(`${API}/requests/stream/events`);
      eventSource.onmessage = () => fetchRequests();
      const interval = setInterval(fetchRequests, 10000);
      return () => { eventSource.close(); clearInterval(interval); };
    }
  }, [isAuthenticated, fetchRequests, fetchDrivers]);

  useEffect(() => {
    if (isAuthenticated && activeTab === "history") {
      fetchHistory();
    }
  }, [isAuthenticated, activeTab, fetchHistory]);

  // Filter requests
  const filteredRequests = requests.filter(req => {
    if (filter === "active" && req.status !== "aguardando" && req.status !== "confirmado") return false;
    if (typeFilter === "immediate" && req.is_scheduled) return false;
    if (typeFilter === "scheduled" && !req.is_scheduled) return false;
    return true;
  }).sort((a, b) => {
    if (typeFilter === "scheduled" && a.is_scheduled && b.is_scheduled) {
      return (a.scheduled_datetime || "").localeCompare(b.scheduled_datetime || "");
    }
    return (b.created_at || "").localeCompare(a.created_at || "");
  });

  const stats = {
    aguardando: requests.filter(r => r.status === "aguardando").length,
    confirmado: requests.filter(r => r.status === "confirmado").length,
    finalizado: requests.filter(r => r.status === "finalizado").length,
    scheduled: requests.filter(r => r.is_scheduled && ["aguardando", "confirmado"].includes(r.status)).length
  };

  const formatScheduledTime = (request) => {
    if (!request.is_scheduled || !request.scheduled_date || !request.scheduled_time) return null;
    try {
      const date = parseISO(request.scheduled_date);
      return `${format(date, "dd/MM/yyyy")} às ${request.scheduled_time}`;
    } catch { return `${request.scheduled_date} às ${request.scheduled_time}`; }
  };

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <audio ref={audioRef} preload="auto">
          <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQsVKo7c77+FSg0AJI7d+M2ZVyEZMpHk+cuNXSgcLI7g98B+VykeMJPj98R/VScaMYzi98B5TxsbNo7h9rxvQhUZOJHj9rlpPRQWOI7e9LJfNA8TMo3c8qpZLw0TL4nY76FTKw0SLYbU7JlNJQsRKoPS6JNHIAkQKH/P5IxCGwgOJXvL4IU8FgYNI3bH3H42EgYMIHHD2Hc0EAULHm2/1XEuDQQKG2q70W0pCQMJGWa3zWklBwIIF2O0yWUiBgEHFV+wxGEfBAEGE1yswV0cAgAFEVmorFoZAQAED1WlqFYWAAADDlKiplMUAAACC0+fpFARAAABC0ycok0PAAABCUWZN0sMAAAACEOXNEkLAAAABz+UMEYJ" type="audio/wav" />
        </audio>
        <Card className="w-full max-w-md border-0 shadow-[0_8px_30px_rgba(30,58,95,0.15)]">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-[#1e3a5f] text-white w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <CardTitle className="text-2xl font-['Manrope'] text-[#1e3a5f]">ARC Control</CardTitle>
            <p className="text-sm text-slate-500 mt-1">Painel Administrativo</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label>Senha de Acesso</Label>
                <Input type="password" placeholder="Digite a senha" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-12" />
              </div>
              <Button type="submit" disabled={verifying || !password} className="w-full h-12 btn-navy">
                {verifying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verificando...</> : "Entrar"}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-slate-500">Voltar</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQsVKo7c77+FSg0AJI7d+M2ZVyEZMpHk+cuNXSgcLI7g98B+VykeMJPj98R/VScaMYzi98B5TxsbNo7h9rxvQhUZOJHj9rlpPRQWOI7e9LJfNA8TMo3c8qpZLw0TL4nY76FTKw0SLYbU7JlNJQsRKoPS6JNHIAkQKH/P5IxCGwgOJXvL4IU8FgYNI3bH3H42EgYMIHHD2Hc0EAULHm2/1XEuDQQKG2q70W0pCQMJGWa3zWklBwIIF2O0yWUiBgEHFV+wxGEfBAEGE1yswV0cAgAFEVmorFoZAQAED1WlqFYWAAADDlKiplMUAAACC0+fpFARAAABC0ycok0PAAABCUWZN0sMAAAACEOXNEkLAAAABz+UMEYJ" type="audio/wav" />
      </audio>
      
      <header className="sticky top-0 z-50 bg-[#1e3a5f] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg"><LayoutDashboard className="w-6 h-6" /></div>
            <div>
              <h1 className="font-bold text-lg font-['Manrope']">ARC Control</h1>
              <p className="text-xs text-white/70">Painel Administrativo</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={fetchRequests} className="text-white/80 hover:text-white hover:bg-white/10">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white/80 hover:text-white hover:bg-white/10">
              <LogOut className="w-4 h-4 mr-1" />Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="requests">Solicitações</TabsTrigger>
            <TabsTrigger value="drivers">Motoristas</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          {/* REQUESTS TAB */}
          <TabsContent value="requests" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-white">
                <CardContent className="p-4 flex items-center justify-between">
                  <div><p className="text-sm text-amber-600">Aguardando</p><p className="text-3xl font-bold text-amber-700">{stats.aguardando}</p></div>
                  <div className="bg-amber-100 p-3 rounded-xl"><Clock className="w-6 h-6 text-amber-600" /></div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
                <CardContent className="p-4 flex items-center justify-between">
                  <div><p className="text-sm text-emerald-600">Em Andamento</p><p className="text-3xl font-bold text-emerald-700">{stats.confirmado}</p></div>
                  <div className="bg-emerald-100 p-3 rounded-xl"><Car className="w-6 h-6 text-emerald-600" /></div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white">
                <CardContent className="p-4 flex items-center justify-between">
                  <div><p className="text-sm text-slate-600">Finalizados</p><p className="text-3xl font-bold text-slate-700">{stats.finalizado}</p></div>
                  <div className="bg-slate-100 p-3 rounded-xl"><Flag className="w-6 h-6 text-slate-600" /></div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-white">
                <CardContent className="p-4 flex items-center justify-between">
                  <div><p className="text-sm text-blue-600">Agendados</p><p className="text-3xl font-bold text-blue-700">{stats.scheduled}</p></div>
                  <div className="bg-blue-100 p-3 rounded-xl"><CalendarIcon className="w-6 h-6 text-blue-600" /></div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="flex gap-2">
                <Button variant={filter === "active" ? "default" : "outline"} size="sm" onClick={() => setFilter("active")} className={filter === "active" ? "btn-navy" : ""}>Ativos</Button>
                <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")} className={filter === "all" ? "btn-navy" : ""}>Todos</Button>
              </div>
              <div className="w-px h-8 bg-slate-200 mx-2" />
              <div className="flex gap-2">
                <Button variant={typeFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("all")} className={typeFilter === "all" ? "btn-navy" : ""}>Todos</Button>
                <Button variant={typeFilter === "immediate" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("immediate")} className={typeFilter === "immediate" ? "btn-navy" : ""}><Car className="w-4 h-4 mr-1" />Imediatos</Button>
                <Button variant={typeFilter === "scheduled" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("scheduled")} className={typeFilter === "scheduled" ? "btn-navy" : ""}><CalendarIcon className="w-4 h-4 mr-1" />Agendados</Button>
              </div>
              <div className="ml-auto">
                <Button variant="outline" size="sm" onClick={() => { setUploadType("employees"); setUploadModalOpen(true); }}>
                  <Upload className="w-4 h-4 mr-1" />Importar Funcionários
                </Button>
              </div>
            </div>

            {/* Requests List */}
            {loading && requests.length === 0 ? (
              <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#1e3a5f]" /></div>
            ) : filteredRequests.length === 0 ? (
              <Card className="border-0 shadow-sm"><CardContent className="py-12 text-center"><Car className="w-12 h-12 mx-auto text-slate-300 mb-3" /><p className="text-slate-500">Nenhuma solicitação</p></CardContent></Card>
            ) : (
              <div className="space-y-4">
                {filteredRequests.map((request) => {
                  const statusConfig = STATUS_CONFIG[request.status];
                  const StatusIcon = statusConfig.icon;
                  const scheduledTimeStr = formatScheduledTime(request);
                  const allPassengers = [request.main_passenger, ...request.additional_passengers];
                  
                  return (
                    <Card key={request.id} className={`border-0 shadow-sm border-l-4 ${statusConfig.borderColor}`}>
                      <CardContent className="p-5">
                        <div className="flex flex-col gap-4">
                          {/* Header */}
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={`${statusConfig.className} text-xs`}><StatusIcon className="w-3 h-3 mr-1" />{statusConfig.label}</Badge>
                              {request.is_scheduled && <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs"><CalendarIcon className="w-3 h-3 mr-1" />Agendado</Badge>}
                              <span className="text-xs text-slate-400">ID: {request.id.slice(0, 8)}</span>
                            </div>
                            <div className="flex gap-2">
                              {request.status === "aguardando" && (
                                <Button onClick={() => openDriverModal(request)} className="btn-navy text-sm">
                                  <CheckCircle2 className="w-4 h-4 mr-1" />Aceitar e Designar
                                </Button>
                              )}
                              {request.status === "confirmado" && (
                                <>
                                  <Button variant="outline" size="sm" onClick={() => openDriverModal(request)} className="text-[#1e3a5f]">
                                    <Edit2 className="w-4 h-4 mr-1" />Editar Motorista
                                  </Button>
                                  <Button onClick={() => updateStatus(request.id, "finalizado")} variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                                    <Flag className="w-4 h-4 mr-1" />Finalizar
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Driver Info */}
                          {request.driver_name && (
                            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                              <div className="flex items-center gap-2 text-emerald-700 mb-1">
                                <Truck className="w-4 h-4" /><span className="text-xs font-semibold uppercase">Motorista</span>
                              </div>
                              <p className="font-medium text-emerald-800">{request.driver_name}</p>
                              {request.driver_phone && (
                                <a href={`tel:${request.driver_phone}`} className="text-emerald-600 hover:underline text-sm flex items-center gap-1 mt-1">
                                  <Phone className="w-3 h-3" />{request.driver_phone}
                                </a>
                              )}
                            </div>
                          )}

                          {/* Scheduled Time - Editable */}
                          {scheduledTimeStr && (
                            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-blue-600" />
                                <span className="text-sm text-blue-700">Agendado:</span>
                                <span className="font-medium text-blue-800">{scheduledTimeStr}</span>
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => openEditSchedule(request)} className="text-blue-600 hover:bg-blue-100">
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}

                          {/* Requester */}
                          <div className="p-3 bg-[#1e3a5f]/5 rounded-lg">
                            <div className="flex items-center gap-2 text-[#1e3a5f]"><User className="w-4 h-4" /><span className="text-xs font-semibold uppercase">Solicitante</span></div>
                            <p className="mt-1 font-medium text-slate-800">{request.requester_name}</p>
                          </div>

                          {/* Origin & Destination */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-50 rounded-lg">
                              <div className="flex items-center gap-1 text-slate-500 text-xs uppercase mb-1"><Building className="w-3 h-3" />Origem</div>
                              <p className="font-medium text-slate-700">{request.origin_address || "FIXAR"}</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                              <div className="flex items-center gap-1 text-slate-500 text-xs uppercase mb-1"><Navigation className="w-3 h-3" />Destino</div>
                              <p className="font-medium text-slate-700">{request.destination_address}</p>
                            </div>
                          </div>

                          {/* Passengers */}
                          <div>
                            <div className="flex items-center gap-2 text-sm text-slate-600 mb-2"><Users className="w-4 h-4" /><span className="font-medium">{allPassengers.length} passageiro(s)</span></div>
                            <div className="space-y-2">
                              {allPassengers.map((p, idx) => (
                                <div key={idx} className="p-2 bg-slate-50 rounded text-sm">
                                  <span className="font-medium">{p.full_name}</span> <span className="text-slate-400">({p.matricula})</span>
                                  {idx === 0 && <Badge variant="secondary" className="ml-2 text-xs py-0">Principal</Badge>}
                                  {p.phone && <a href={`tel:${p.phone}`} className="ml-2 text-[#1e3a5f] hover:underline"><Phone className="w-3 h-3 inline" /> {p.phone}</a>}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Cancellation Reason */}
                          {request.status === "cancelado" && request.cancellation_reason && (
                            <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                              <div className="flex items-center gap-2 text-red-700"><AlertCircle className="w-4 h-4" /><span className="text-xs font-semibold uppercase">Motivo Cancelamento</span></div>
                              <p className="mt-1 font-medium text-red-800">{request.cancellation_reason}</p>
                            </div>
                          )}

                          <p className="text-xs text-slate-400 text-right">Criado: {new Date(request.created_at).toLocaleString('pt-BR')}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* DRIVERS TAB */}
          <TabsContent value="drivers" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#1e3a5f]">Motoristas Cadastrados</h2>
              <Button onClick={() => { setUploadType("drivers"); setUploadModalOpen(true); }} className="btn-navy">
                <Upload className="w-4 h-4 mr-2" />Importar Motoristas
              </Button>
            </div>

            {loadingDrivers ? (
              <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>
            ) : drivers.length === 0 ? (
              <Card className="border-0 shadow-sm"><CardContent className="py-12 text-center"><UserCog className="w-12 h-12 mx-auto text-slate-300 mb-3" /><p className="text-slate-500">Nenhum motorista cadastrado</p></CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {drivers.map((driver) => (
                  <Card key={driver.id} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-[#1e3a5f]/10 p-3 rounded-full"><Truck className="w-5 h-5 text-[#1e3a5f]" /></div>
                        <div>
                          <p className="font-medium text-slate-800">{driver.name}</p>
                          {driver.phone && <a href={`tel:${driver.phone}`} className="text-sm text-[#1e3a5f] hover:underline flex items-center gap-1"><Phone className="w-3 h-3" />{driver.phone}</a>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* HISTORY TAB */}
          <TabsContent value="history" className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-[#1e3a5f]">Histórico de Solicitações</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm"><CalendarIcon className="w-4 h-4 mr-1" />{startDate ? format(startDate, "dd/MM/yyyy") : "Data Início"}</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} locale={ptBR} />
                  </PopoverContent>
                </Popover>
                <span className="text-slate-400">até</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm"><CalendarIcon className="w-4 h-4 mr-1" />{endDate ? format(endDate, "dd/MM/yyyy") : "Data Fim"}</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} locale={ptBR} />
                  </PopoverContent>
                </Popover>
                <Button variant="outline" size="sm" onClick={() => { setStartDate(null); setEndDate(null); }}>Limpar</Button>
                <Button onClick={handleExportCSV} className="btn-navy"><Download className="w-4 h-4 mr-1" />Exportar CSV</Button>
              </div>
            </div>

            {historyLoading ? (
              <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>
            ) : (
              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Data</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Solicitante</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Passageiro</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Origem</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Destino</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Motorista</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyData.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 whitespace-nowrap">{new Date(req.created_at).toLocaleDateString('pt-BR')}</td>
                          <td className="px-4 py-3">{req.requester_name}</td>
                          <td className="px-4 py-3">{req.main_passenger?.full_name}</td>
                          <td className="px-4 py-3">{req.origin_address || "FIXAR"}</td>
                          <td className="px-4 py-3">{req.destination_address}</td>
                          <td className="px-4 py-3">{req.driver_name || "-"}</td>
                          <td className="px-4 py-3"><Badge className={STATUS_CONFIG[req.status]?.className}>{STATUS_CONFIG[req.status]?.label}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {historyData.length === 0 && <p className="text-center py-8 text-slate-500">Nenhum registro encontrado</p>}
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Upload Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f] flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" />Importar {uploadType === "drivers" ? "Motoristas" : "Funcionários"}</DialogTitle>
            <DialogDescription>Faça upload de um arquivo CSV.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-slate-50 rounded-lg border">
              <p className="text-sm text-slate-600 mb-2">Colunas: <strong>{uploadType === "drivers" ? "name, phone" : "matricula, name, address, phone"}</strong></p>
              <Button variant="outline" size="sm" onClick={() => downloadTemplate(uploadType)}><Download className="w-4 h-4 mr-1" />Baixar Template</Button>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="replaceAll" checked={replaceAll} onChange={(e) => setReplaceAll(e.target.checked)} className="w-4 h-4 rounded" />
              <Label htmlFor="replaceAll" className="text-sm text-slate-600 cursor-pointer">Substituir todos os registros</Label>
            </div>
            <input type="file" ref={fileInputRef} accept=".csv" onChange={handleCSVUpload} className="hidden" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUploadModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-navy">
              {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando...</> : <><Upload className="w-4 h-4 mr-2" />Selecionar CSV</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Driver Assignment Modal */}
      <Dialog open={driverModalOpen} onOpenChange={setDriverModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">Designar Motorista</DialogTitle>
            <DialogDescription>Selecione ou cadastre um motorista para esta corrida.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motorista</Label>
              <Select value={selectedDriverId} onValueChange={(val) => {
                setSelectedDriverId(val);
                if (val && val !== "outro") {
                  const driver = drivers.find(d => d.id === val);
                  if (driver) {
                    setCustomDriverName(driver.name);
                    setCustomDriverPhone(driver.phone);
                  }
                } else {
                  setCustomDriverName("");
                  setCustomDriverPhone("");
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione um motorista" /></SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name} - {d.phone}</SelectItem>
                  ))}
                  <SelectItem value="outro">Outro (digitar manualmente)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedDriverId === "outro" && (
              <div className="space-y-4 animate-slide-in">
                <div className="space-y-2">
                  <Label>Nome do Motorista</Label>
                  <Input placeholder="Nome completo" value={customDriverName} onChange={(e) => setCustomDriverName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input placeholder="(11) 99999-9999" value={customDriverPhone} onChange={(e) => setCustomDriverPhone(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDriverModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleAssignDriver} disabled={assigningDriver} className="btn-navy">
              {assigningDriver ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Designando...</> : "Confirmar e Aceitar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Schedule Modal */}
      <Dialog open={editScheduleOpen} onOpenChange={setEditScheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">Editar Agendamento</DialogTitle>
            <DialogDescription>Altere a data e horário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={`w-full h-12 justify-start ${!editDate && "text-muted-foreground"}`}>
                    <CalendarIcon className="mr-2 h-4 w-4" />{editDate ? format(editDate, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={editDate} onSelect={setEditDate} disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Horário</Label>
              <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="h-12" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditScheduleOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveSchedule} disabled={savingSchedule || !editDate || !editTime} className="btn-navy">
              {savingSchedule ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
