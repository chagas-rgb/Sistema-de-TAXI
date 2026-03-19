import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Radio
} from "lucide-react";

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
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Fetch active requests
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

  // Setup SSE connection for real-time updates
  useEffect(() => {
    fetchRequests();

    // SSE for real-time updates
    const eventSource = new EventSource(`${API}/requests/stream/events`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_request" || data.type === "status_update") {
          fetchRequests();
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    // Auto-refresh every 15 seconds as backup
    const interval = setInterval(fetchRequests, 15000);

    return () => {
      eventSource.close();
      clearInterval(interval);
    };
  }, [fetchRequests]);

  // Open cancel modal
  const openCancelModal = (request) => {
    setSelectedRequest(request);
    setCancelReason("");
    setCustomReason("");
    setCancelModalOpen(true);
  };

  // Handle cancellation
  const handleCancel = async () => {
    if (!cancelReason) {
      toast.error("Por favor, selecione um motivo");
      return;
    }

    const finalReason = cancelReason === "outro" 
      ? customReason || "Outro motivo não especificado"
      : CANCELLATION_REASONS.find(r => r.value === cancelReason)?.label || cancelReason;

    setCancelling(true);
    try {
      await axios.post(`${API}/requests/${selectedRequest.id}/cancel`, {
        reason: finalReason
      });
      toast.success("Solicitação cancelada com sucesso");
      setCancelModalOpen(false);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao cancelar solicitação");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#1e3a5f] text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="text-white hover:bg-white/10 -ml-2"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-lg">
                <Radio className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-tight font-['Manrope']">Acompanhamento</h1>
                <p className="text-xs text-white/70">Solicitações em tempo real</p>
              </div>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchRequests}
            className="text-white/80 hover:text-white hover:bg-white/10"
            data-testid="refresh-tracking"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Live indicator */}
        <div className="flex items-center gap-2 mb-6 text-sm text-slate-600">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span>Atualizações em tempo real</span>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#1e3a5f]" />
            <p className="mt-2 text-slate-500">Carregando solicitações...</p>
          </div>
        ) : requests.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <Car className="w-16 h-16 mx-auto text-slate-200 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhuma solicitação ativa</h3>
              <p className="text-slate-500 mb-6">Não há solicitações aguardando ou em andamento no momento.</p>
              <Button
                onClick={() => navigate("/")}
                className="btn-navy"
                data-testid="new-request-link"
              >
                <Car className="w-4 h-4 mr-2" />
                Solicitar Táxi
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const statusConfig = STATUS_CONFIG[request.status];
              const StatusIcon = statusConfig?.icon || Clock;
              const allPassengers = [request.main_passenger, ...request.additional_passengers];
              
              return (
                <Card 
                  key={request.id}
                  className="border-0 shadow-[0_2px_12px_rgba(30,58,95,0.08)] overflow-hidden"
                  data-testid={`tracking-card-${request.id}`}
                >
                  {/* Status bar */}
                  <div className={`h-1 ${request.status === 'aguardando' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                  
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Badge className={`${statusConfig?.bgColor} ${statusConfig?.textColor} border ${statusConfig?.borderColor} flex items-center gap-2 px-3 py-1.5`}>
                            <span className={`w-2 h-2 rounded-full ${statusConfig?.dotColor} animate-pulse`}></span>
                            {statusConfig?.label}
                          </Badge>
                        </div>
                        
                        {/* Cancel button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCancelModal(request)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          data-testid={`cancel-btn-${request.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Cancelar
                        </Button>
                      </div>

                      {/* Requester */}
                      <div className="flex items-center gap-2 p-3 bg-[#1e3a5f]/5 rounded-lg">
                        <User className="w-4 h-4 text-[#1e3a5f]" />
                        <span className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide">Solicitante:</span>
                        <span className="font-medium text-slate-800" data-testid={`requester-${request.id}`}>
                          {request.requester_name || "N/A"}
                        </span>
                      </div>

                      {/* Passengers */}
                      <div>
                        <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                          <Users className="w-4 h-4" />
                          <span className="font-medium">
                            {allPassengers.length} passageiro{allPassengers.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {allPassengers.map((p, idx) => (
                            <Badge 
                              key={idx} 
                              variant="secondary" 
                              className="bg-slate-100 text-slate-700"
                              data-testid={`passenger-badge-${request.id}-${idx}`}
                            >
                              {p.full_name}
                              {idx === 0 && <span className="ml-1 text-[#1e3a5f]">(Principal)</span>}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Destination */}
                      <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                        <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div>
                          <span className="text-xs text-slate-500 uppercase tracking-wide">Destino</span>
                          <p className="font-medium text-slate-700">{request.destination_address}</p>
                        </div>
                      </div>

                      {/* Time */}
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

        {/* Navigation link */}
        <div className="mt-8 text-center">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="text-[#1e3a5f] border-[#1e3a5f]/20"
          >
            <Car className="w-4 h-4 mr-2" />
            Solicitar Novo Táxi
          </Button>
        </div>
      </main>

      {/* Cancel Modal */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f] font-['Manrope']">
              Cancelar Solicitação
            </DialogTitle>
            <DialogDescription>
              Por favor, informe o motivo do cancelamento.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo do cancelamento</Label>
              <Select value={cancelReason} onValueChange={setCancelReason}>
                <SelectTrigger data-testid="cancel-reason-select">
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {CANCELLATION_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {cancelReason === "outro" && (
              <div className="space-y-2 animate-slide-in">
                <Label>Descreva o motivo</Label>
                <Textarea
                  placeholder="Digite o motivo do cancelamento..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="min-h-[80px]"
                  data-testid="custom-reason-input"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCancelModalOpen(false)}
              disabled={cancelling}
            >
              Voltar
            </Button>
            <Button
              onClick={handleCancel}
              disabled={cancelling || !cancelReason || (cancelReason === "outro" && !customReason.trim())}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="confirm-cancel-btn"
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelando...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Confirmar Cancelamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
