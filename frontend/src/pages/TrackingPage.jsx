import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
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
import { Textarea } from "@/components/ui/textarea";
import { 
  Car, 
  Clock, 
  Users, 
  MapPin,
  Loader2,
  ArrowLeft,
  XCircle,
  RefreshCw,
  User,
  Radio,
  CalendarIcon,
  Phone,
  Edit2,
  Building,
  Navigation
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  aguardando: {
    label: "Aguardando",
    icon: Clock,
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-200",
    dotColor: "bg-amber-500"
  },
  confirmado: {
    label: "Confirmado - Táxi a caminho",
    icon: Car,
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-200",
    dotColor: "bg-emerald-500"
  }
};

const CANCELLATION_REASONS = [
  { value: "saiu_cedo", label: "Passageiro saiu mais cedo" },
  { value: "nao_necessario", label: "Não é mais necessário" },
  { value: "erro_solicitacao", label: "Erro na solicitação" },
  { value: "outro", label: "Outro" }
];

export default function TrackingPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Cancel modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  
  // Edit schedule modal
  const [editScheduleOpen, setEditScheduleOpen] = useState(false);
  const [editDate, setEditDate] = useState(null);
  const [editTime, setEditTime] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/requests/active`);
      setRequests(response.data);
    } catch (error) {
      toast.error("Erro ao carregar solicitações");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    const eventSource = new EventSource(`${API}/requests/stream/events`);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (["new_request", "status_update", "driver_assigned", "schedule_update"].includes(data.type)) {
          fetchRequests();
        }
      } catch (e) {}
    };
    const interval = setInterval(fetchRequests, 15000);
    return () => {
      eventSource.close();
      clearInterval(interval);
    };
  }, [fetchRequests]);

  const openCancelModal = (request) => {
    setSelectedRequest(request);
    setCancelReason("");
    setCustomReason("");
    setCancelModalOpen(true);
  };

  const handleCancel = async () => {
    if (!cancelReason) {
      toast.error("Por favor, selecione um motivo");
      return;
    }
    const finalReason = cancelReason === "outro" 
      ? customReason || "Outro motivo não especificado"
      : CANCELLATION_REASONS.find(r => r.value === cancelReason)?.label;

    setCancelling(true);
    try {
      await axios.post(`${API}/requests/${selectedRequest.id}/cancel`, { reason: finalReason });
      toast.success("Solicitação cancelada");
      setCancelModalOpen(false);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao cancelar");
    } finally {
      setCancelling(false);
    }
  };

  const openEditSchedule = (request) => {
    setSelectedRequest(request);
    if (request.scheduled_date) {
      try {
        setEditDate(parseISO(request.scheduled_date));
      } catch {
        setEditDate(null);
      }
    }
    setEditTime(request.scheduled_time || "");
    setEditScheduleOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!editDate || !editTime) {
      toast.error("Por favor, selecione data e horário");
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

  const formatScheduledTime = (req) => {
    if (!req.is_scheduled || !req.scheduled_date || !req.scheduled_time) return null;
    try {
      const date = parseISO(req.scheduled_date);
      return `${format(date, "dd/MM/yyyy", { locale: ptBR })} às ${req.scheduled_time}`;
    } catch {
      return `${req.scheduled_date} às ${req.scheduled_time}`;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 bg-[#1e3a5f] text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-white hover:bg-white/10 -ml-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-lg"><Radio className="w-6 h-6" /></div>
              <div>
                <h1 className="font-bold text-lg font-['Manrope']">Acompanhamento</h1>
                <p className="text-xs text-white/70">Solicitações em tempo real</p>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchRequests} className="text-white/80 hover:text-white hover:bg-white/10">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-6 text-sm text-slate-600">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span>Atualizações em tempo real</span>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#1e3a5f]" />
          </div>
        ) : requests.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <Car className="w-16 h-16 mx-auto text-slate-200 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhuma solicitação ativa</h3>
              <Button onClick={() => navigate("/")} className="btn-navy mt-4">
                <Car className="w-4 h-4 mr-2" />Solicitar Táxi
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const statusConfig = STATUS_CONFIG[request.status];
              const scheduledTimeStr = formatScheduledTime(request);
              const allPassengers = [request.main_passenger, ...request.additional_passengers];
              
              return (
                <Card key={request.id} className="border-0 shadow-[0_2px_12px_rgba(30,58,95,0.08)] overflow-hidden">
                  <div className={`h-1 ${request.status === 'aguardando' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4">
                      {/* Header */}
                      <div className="flex items-start justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`${statusConfig?.bgColor} ${statusConfig?.textColor} border ${statusConfig?.borderColor} flex items-center gap-2 px-3 py-1.5`}>
                            <span className={`w-2 h-2 rounded-full ${statusConfig?.dotColor} animate-pulse`}></span>
                            {statusConfig?.label}
                          </Badge>
                          {request.is_scheduled && (
                            <Badge className="bg-blue-50 text-blue-700 border border-blue-200">
                              <CalendarIcon className="w-3 h-3 mr-1" />Agendado
                            </Badge>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => openCancelModal(request)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                          <XCircle className="w-4 h-4 mr-1" />Cancelar
                        </Button>
                      </div>

                      {/* Driver Info - Prominent */}
                      {request.status === "confirmado" && (
                        <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                          <div className="flex items-center gap-2 text-emerald-700 mb-2">
                            <Car className="w-5 h-5" />
                            <span className="font-semibold">Motorista Designado</span>
                          </div>
                          {request.driver_name ? (
                            <div className="space-y-2">
                              <p className="text-lg font-semibold text-emerald-800">{request.driver_name}</p>
                              {request.driver_phone && (
                                <a 
                                  href={`tel:${request.driver_phone}`} 
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                >
                                  <Phone className="w-4 h-4" />
                                  <span className="font-medium">{request.driver_phone}</span>
                                </a>
                              )}
                            </div>
                          ) : (
                            <p className="text-emerald-600 italic">Aguardando designação de motorista</p>
                          )}
                        </div>
                      )}

                      {/* Scheduled Time - Editable */}
                      {scheduledTimeStr && (
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-blue-700">Agendado Para:</span>
                            <span className="font-medium text-blue-800">{scheduledTimeStr}</span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => openEditSchedule(request)} className="text-blue-600 hover:bg-blue-100">
                            <Edit2 className="w-4 h-4 mr-1" />Editar
                          </Button>
                        </div>
                      )}

                      {/* Requester */}
                      <div className="flex items-center gap-2 p-3 bg-[#1e3a5f]/5 rounded-lg">
                        <User className="w-4 h-4 text-[#1e3a5f]" />
                        <span className="text-xs font-semibold text-[#1e3a5f] uppercase">Solicitante:</span>
                        <span className="font-medium text-slate-800">{request.requester_name || "N/A"}</span>
                      </div>

                      {/* Origin & Destination */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                          <Building className="w-4 h-4 text-slate-400 mt-0.5" />
                          <div>
                            <span className="text-xs text-slate-500 uppercase">Origem</span>
                            <p className="font-medium text-slate-700">{request.origin_address || "FIXAR"}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                          <Navigation className="w-4 h-4 text-slate-400 mt-0.5" />
                          <div>
                            <span className="text-xs text-slate-500 uppercase">Destino</span>
                            <p className="font-medium text-slate-700">{request.destination_address}</p>
                          </div>
                        </div>
                      </div>

                      {/* Passengers */}
                      <div>
                        <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                          <Users className="w-4 h-4" />
                          <span className="font-medium">{allPassengers.length} passageiro{allPassengers.length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {allPassengers.map((p, idx) => (
                            <Badge key={idx} variant="secondary" className="bg-slate-100 text-slate-700">
                              {p.full_name}{idx === 0 && <span className="ml-1 text-[#1e3a5f]">(Principal)</span>}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="text-xs text-slate-400 text-right">
                        Solicitado: {new Date(request.created_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button variant="outline" onClick={() => navigate("/")} className="text-[#1e3a5f] border-[#1e3a5f]/20">
            <Car className="w-4 h-4 mr-2" />Solicitar Novo Táxi
          </Button>
        </div>
      </main>

      {/* Cancel Modal */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">Cancelar Solicitação</DialogTitle>
            <DialogDescription>Informe o motivo do cancelamento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={cancelReason} onValueChange={setCancelReason}>
              <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
              <SelectContent>
                {CANCELLATION_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cancelReason === "outro" && (
              <Textarea placeholder="Digite o motivo..." value={customReason} onChange={(e) => setCustomReason(e.target.value)} className="min-h-[80px]" />
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelModalOpen(false)}>Voltar</Button>
            <Button onClick={handleCancel} disabled={cancelling || !cancelReason} className="bg-red-600 hover:bg-red-700 text-white">
              {cancelling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelando...</> : <><XCircle className="w-4 h-4 mr-2" />Confirmar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Schedule Modal */}
      <Dialog open={editScheduleOpen} onOpenChange={setEditScheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">Editar Agendamento</DialogTitle>
            <DialogDescription>Altere a data e horário do agendamento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={`w-full h-12 justify-start ${!editDate && "text-muted-foreground"}`}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editDate ? format(editDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
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
              {savingSchedule ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
