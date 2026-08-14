import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Car, MapPin, Clock, Phone, Users, Navigation, CheckCircle2, 
  XCircle, AlertTriangle, Loader2, LogOut, RefreshCw, Calendar,
  Play, Square, MessageSquare, Camera, User
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700",
  scheduled: "bg-blue-100 text-blue-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-100 text-red-700"
};

const STATUS_LABELS = {
  pending: "Aguardando",
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em Andamento",
  completed: "Finalizado",
  cancelled: "Cancelado"
};

export default function DriverPortal() {
  const navigate = useNavigate();
  const { user, logout, token } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [activeTab, setActiveTab] = useState("today");
  
  // Action states
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [driverNotes, setDriverNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/trips`, { headers });
      
      // Filter trips assigned to this driver (or all if not specified)
      const driverTrips = response.data.filter(t => 
        t.status !== 'cancelled' && 
        t.status !== 'completed' &&
        (t.driver_id === user?.user_id || !t.driver_id)
      );
      
      setTrips(driverTrips);
    } catch (error) {
      toast.error("Erro ao carregar viagens");
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    fetchTrips();
    // Refresh every 30 seconds
    const interval = setInterval(fetchTrips, 30000);
    return () => clearInterval(interval);
  }, [fetchTrips]);

  const handleStatusUpdate = async (tripId, newStatus) => {
    setActionLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.put(
        `${API}/trips/${tripId}/status`,
        { status: newStatus },
        { headers }
      );
      toast.success(`Viagem ${STATUS_LABELS[newStatus].toLowerCase()}`);
      fetchTrips();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao atualizar status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const todayTrips = trips.filter(t => {
    if (!t.scheduled_date) return t.status === 'pending' || t.status === 'confirmed';
    const today = new Date().toISOString().split('T')[0];
    return t.scheduled_date === today;
  });

  const upcomingTrips = trips.filter(t => {
    if (!t.scheduled_date) return false;
    const today = new Date().toISOString().split('T')[0];
    return t.scheduled_date > today;
  });

  const inProgressTrips = trips.filter(t => t.status === 'in_progress');

  if (loading && trips.length === 0) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#1e3a5f] text-white shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg font-['Manrope']">Portal do Motorista</h1>
              <p className="text-xs text-white/70">{user?.name || "Motorista"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchTrips}
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
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-[#1e3a5f]">{todayTrips.length}</p>
              <p className="text-xs text-slate-500">Hoje</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-purple-600">{inProgressTrips.length}</p>
              <p className="text-xs text-slate-500">Em Andamento</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{upcomingTrips.length}</p>
              <p className="text-xs text-slate-500">Próximas</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="today" className="flex-1">Hoje ({todayTrips.length})</TabsTrigger>
            <TabsTrigger value="upcoming" className="flex-1">Próximas ({upcomingTrips.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            {todayTrips.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-8 text-center">
                  <Car className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">Nenhuma viagem para hoje</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {todayTrips.map((trip) => (
                  <TripCard 
                    key={trip.id} 
                    trip={trip} 
                    onSelect={() => setSelectedTrip(trip)}
                    onStatusUpdate={handleStatusUpdate}
                    actionLoading={actionLoading}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upcoming">
            {upcomingTrips.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-8 text-center">
                  <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">Nenhuma viagem agendada</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {upcomingTrips.map((trip) => (
                  <TripCard 
                    key={trip.id} 
                    trip={trip} 
                    onSelect={() => setSelectedTrip(trip)}
                    onStatusUpdate={handleStatusUpdate}
                    actionLoading={actionLoading}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Trip Detail Modal */}
      <Dialog open={!!selectedTrip} onOpenChange={() => setSelectedTrip(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da Viagem</DialogTitle>
          </DialogHeader>
          {selectedTrip && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge className={STATUS_COLORS[selectedTrip.status]}>
                  {STATUS_LABELS[selectedTrip.status]}
                </Badge>
                {selectedTrip.is_scheduled && (
                  <span className="text-sm text-slate-500">
                    {selectedTrip.scheduled_date} às {selectedTrip.scheduled_time}
                  </span>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <p className="text-xs text-emerald-600 font-medium mb-1">ORIGEM</p>
                  <p className="text-sm text-emerald-800">{selectedTrip.origin_address || "FIXAR"}</p>
                </div>
                
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium mb-1">DESTINO</p>
                  <p className="text-sm text-blue-800">{selectedTrip.destination_address || "N/A"}</p>
                </div>
              </div>
              
              <div>
                <p className="text-xs text-slate-500 font-medium mb-2">PASSAGEIROS ({selectedTrip.passenger_count})</p>
                <div className="space-y-2">
                  {selectedTrip.passengers?.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium">{p.name}</span>
                      </div>
                      {p.phone && (
                        <a href={`tel:${p.phone}`} className="text-[#1e3a5f]">
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {selectedTrip?.status === 'confirmed' && (
              <Button 
                onClick={() => {
                  handleStatusUpdate(selectedTrip.id, 'in_progress');
                  setSelectedTrip(null);
                }}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Iniciar Viagem
              </Button>
            )}
            {selectedTrip?.status === 'in_progress' && (
              <Button 
                onClick={() => {
                  handleStatusUpdate(selectedTrip.id, 'completed');
                  setSelectedTrip(null);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Finalizar Viagem
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TripCard({ trip, onSelect, onStatusUpdate, actionLoading }) {
  const mainPassenger = trip.passengers?.[0] || {};
  
  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardContent className="p-0">
        <div className="p-4" onClick={onSelect}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-semibold text-slate-800">{mainPassenger.name || trip.requester_name}</p>
              {trip.passenger_count > 1 && (
                <p className="text-xs text-slate-500">+{trip.passenger_count - 1} passageiros</p>
              )}
            </div>
            <Badge className={STATUS_COLORS[trip.status]}>
              {STATUS_LABELS[trip.status]}
            </Badge>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <MapPin className="w-4 h-4 text-emerald-500" />
              <span className="truncate">{trip.origin_address || "FIXAR"}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Navigation className="w-4 h-4 text-blue-500" />
              <span className="truncate">{trip.destination_address || mainPassenger.address || "N/A"}</span>
            </div>
            {trip.is_scheduled && (
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>{trip.scheduled_time || "A definir"}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Quick Actions */}
        {(trip.status === 'confirmed' || trip.status === 'in_progress') && (
          <div className="flex border-t border-slate-100">
            {trip.status === 'confirmed' && (
              <Button 
                variant="ghost" 
                className="flex-1 rounded-none text-purple-600 hover:bg-purple-50"
                onClick={() => onStatusUpdate(trip.id, 'in_progress')}
                disabled={actionLoading}
              >
                <Play className="w-4 h-4 mr-2" />
                Iniciar
              </Button>
            )}
            {trip.status === 'in_progress' && (
              <Button 
                variant="ghost" 
                className="flex-1 rounded-none text-emerald-600 hover:bg-emerald-50"
                onClick={() => onStatusUpdate(trip.id, 'completed')}
                disabled={actionLoading}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Finalizar
              </Button>
            )}
            {mainPassenger.phone && (
              <a 
                href={`tel:${mainPassenger.phone}`}
                className="flex-1 flex items-center justify-center text-slate-600 hover:bg-slate-50 border-l border-slate-100"
              >
                <Phone className="w-4 h-4 mr-2" />
                Ligar
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
