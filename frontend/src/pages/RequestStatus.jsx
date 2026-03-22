import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Car, Clock, MapPin, Users, ArrowLeft, CheckCircle2, XCircle, Loader2,
  RefreshCw, Phone, User, CalendarIcon, Building, Navigation, Truck
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  aguardando: { label: "Aguardando", description: "Sua solicitação está na fila", icon: Clock, className: "status-aguardando", color: "text-amber-600" },
  confirmado: { label: "Confirmado - Táxi a caminho", description: "Seu táxi foi confirmado e está a caminho", icon: Car, className: "status-confirmado", color: "text-emerald-600" },
  finalizado: { label: "Finalizado", description: "Corrida finalizada. Obrigado por usar ARC Transporte!", icon: CheckCircle2, className: "status-finalizado", color: "text-slate-600" },
  cancelado: { label: "Cancelado", description: "Esta solicitação foi cancelada", icon: XCircle, className: "status-cancelado", color: "text-red-600" }
};

export default function RequestStatus() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const fetchRequest = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/requests/${requestId}`);
      setRequest(response.data);
    } catch (error) {
      toast.error("Solicitação não encontrada");
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [requestId, navigate]);

  useEffect(() => {
    fetchRequest();
    const eventSource = new EventSource(`${API}/requests/stream/events`);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (["status_update", "driver_assigned", "schedule_update"].includes(data.type) && data.data?.id === requestId) {
          setRequest(data.data);
          if (data.type === "status_update") {
            toast.success(STATUS_CONFIG[data.data.status]?.label || "Status atualizado");
          }
          if (data.type === "driver_assigned") {
            toast.success("Motorista designado!");
          }
        }
      } catch (e) {}
    };
    return () => eventSource.close();
  }, [requestId, fetchRequest]);

  const handleCancel = async () => {
    if (!window.confirm("Tem certeza que deseja cancelar?")) return;
    setCancelling(true);
    try {
      await axios.delete(`${API}/requests/${requestId}`);
      toast.success("Solicitação cancelada");
      setRequest(prev => ({ ...prev, status: "cancelado" }));
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao cancelar");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" /></div>;
  }

  if (!request) return null;

  const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.aguardando;
  const StatusIcon = statusConfig.icon;
  const allPassengers = [request.main_passenger, ...request.additional_passengers];

  const formatScheduledTime = () => {
    if (!request.is_scheduled || !request.scheduled_date || !request.scheduled_time) return null;
    try {
      const date = parseISO(request.scheduled_date);
      return `${format(date, "dd/MM/yyyy", { locale: ptBR })} às ${request.scheduled_time}`;
    } catch { return `${request.scheduled_date} às ${request.scheduled_time}`; }
  };

  const scheduledTimeStr = formatScheduledTime();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 bg-[#1e3a5f] text-white shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-white hover:bg-white/10 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg"><Car className="w-6 h-6" /></div>
            <div>
              <h1 className="font-bold text-lg font-['Manrope']">Status da Solicitação</h1>
              <p className="text-xs text-white/70">Acompanhe em tempo real</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Status Card */}
        <Card className="border-0 shadow-[0_4px_20px_rgba(30,58,95,0.1)] mb-6 overflow-hidden">
          <div className={`h-2 ${request.status === 'aguardando' ? 'bg-amber-400' : request.status === 'confirmado' ? 'bg-emerald-500' : request.status === 'cancelado' ? 'bg-red-400' : 'bg-slate-400'}`} />
          <CardContent className="pt-6">
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${request.status === 'aguardando' ? 'bg-amber-50' : request.status === 'confirmado' ? 'bg-emerald-50' : request.status === 'cancelado' ? 'bg-red-50' : 'bg-slate-100'}`}>
                <StatusIcon className={`w-10 h-10 ${statusConfig.color}`} />
              </div>
              <Badge className={`${statusConfig.className} px-4 py-1.5 text-sm font-semibold mb-2`}>{statusConfig.label}</Badge>
              <p className="text-slate-600 mt-2">{statusConfig.description}</p>
            </div>
            <div className="flex justify-center mt-4">
              <Button variant="ghost" size="sm" onClick={fetchRequest} className="text-slate-500 hover:text-[#1e3a5f]">
                <RefreshCw className="w-4 h-4 mr-1" />Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Driver Info - Prominent */}
        {request.status === "confirmado" && (
          <Card className="border-0 shadow-[0_4px_20px_rgba(30,58,95,0.1)] mb-6 bg-emerald-50 border border-emerald-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-['Manrope'] text-emerald-700 flex items-center gap-2">
                <Truck className="w-5 h-5" />Motorista Designado
              </CardTitle>
            </CardHeader>
            <CardContent>
              {request.driver_name ? (
                <div>
                  <p className="text-xl font-semibold text-emerald-800">{request.driver_name}</p>
                  {request.driver_phone && (
                    <a href={`tel:${request.driver_phone}`} className="inline-flex items-center gap-2 mt-3 px-5 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-lg font-medium">
                      <Phone className="w-5 h-5" />{request.driver_phone}
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-emerald-600 italic">Aguardando designação de motorista</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Scheduled Time */}
        {scheduledTimeStr && (
          <Card className="border-0 shadow-[0_4px_20px_rgba(30,58,95,0.1)] mb-6 bg-blue-50 border border-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-['Manrope'] text-blue-700 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />Agendado Para
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-blue-800 text-lg">{scheduledTimeStr}</p>
            </CardContent>
          </Card>
        )}

        {/* Requester */}
        <Card className="border-0 shadow-[0_4px_20px_rgba(30,58,95,0.1)] mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-['Manrope'] text-[#1e3a5f] flex items-center gap-2">
              <User className="w-5 h-5" />Solicitante
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-slate-800">{request.requester_name}</p>
          </CardContent>
        </Card>

        {/* Origin & Destination */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="border-0 shadow-[0_4px_20px_rgba(30,58,95,0.1)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-['Manrope'] text-[#1e3a5f] flex items-center gap-2">
                <Building className="w-5 h-5" />Origem
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-slate-700">{request.origin_address || "FIXAR"}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-[0_4px_20px_rgba(30,58,95,0.1)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-['Manrope'] text-[#1e3a5f] flex items-center gap-2">
                <Navigation className="w-5 h-5" />Destino
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-slate-700">{request.destination_address}</p>
            </CardContent>
          </Card>
        </div>

        {/* Passengers */}
        <Card className="border-0 shadow-[0_4px_20px_rgba(30,58,95,0.1)] mb-6">
          <CardHeader>
            <CardTitle className="text-lg font-['Manrope'] text-[#1e3a5f] flex items-center gap-2">
              <Users className="w-5 h-5" />Passageiros ({allPassengers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {allPassengers.map((passenger, index) => (
              <div key={index} className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-slate-800">{passenger.full_name}</p>
                  {index === 0 && <Badge variant="secondary" className="bg-[#1e3a5f]/10 text-[#1e3a5f]">Principal</Badge>}
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <p><span className="text-slate-400">Matrícula:</span> {passenger.matricula}</p>
                  {passenger.address && <p className="flex items-center gap-2"><MapPin className="w-3 h-3 text-slate-400" />{passenger.address}</p>}
                  {passenger.phone && <p className="flex items-center gap-2"><Phone className="w-3 h-3 text-slate-400" />{passenger.phone}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Cancel Button */}
        {request.status === "aguardando" && (
          <Button variant="outline" onClick={handleCancel} disabled={cancelling} className="w-full h-12 border-red-200 text-red-600 hover:bg-red-50">
            {cancelling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelando...</> : <><XCircle className="w-4 h-4 mr-2" />Cancelar Solicitação</>}
          </Button>
        )}

        {/* New Request Button */}
        {(request.status === "finalizado" || request.status === "cancelado") && (
          <Button onClick={() => navigate("/")} className="w-full h-12 btn-navy">
            <Car className="w-4 h-4 mr-2" />Nova Solicitação
          </Button>
        )}

        <footer className="mt-8 text-center text-sm text-slate-500">
          <p>ID: {request.id.slice(0, 8)}...</p>
        </footer>
      </main>
    </div>
  );
}
