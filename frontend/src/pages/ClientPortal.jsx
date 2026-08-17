import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Car, Building2, Users, Clock, Phone, MapPin, History, 
  Loader2, LogOut, RefreshCw, Calendar, Download, Search,
  CheckCircle2, XCircle, AlertCircle, Receipt
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

export default function ClientPortal() {
  const navigate = useNavigate();
  const { user, logout, token, isAuthenticated } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [company, setCompany] = useState(null);
  const [activeTab, setActiveTab] = useState("active");
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      // Fetch company info
      if (user?.client_company_id) {
        const companyRes = await axios.get(`${API}/companies/${user.client_company_id}`, { headers });
        setCompany(companyRes.data);
      }
      
      // Fetch trips
      const tripsRes = await axios.get(`${API}/trips`, { headers });
      setTrips(tripsRes.data);
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter trips
  const activeTrips = trips.filter(t => 
    ['pending', 'scheduled', 'confirmed', 'in_progress'].includes(t.status)
  );
  
  const historyTrips = trips.filter(t => 
    ['completed', 'cancelled'].includes(t.status)
  ).filter(t => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        t.requester_name?.toLowerCase().includes(search) ||
        t.passengers?.some(p => p.name?.toLowerCase().includes(search)) ||
        t.driver_name?.toLowerCase().includes(search) ||
        t.voucher_number?.toLowerCase().includes(search); // Search by voucher number
      if (!matchesSearch) return false;
    }
    if (startDate && t.created_at < startDate) return false;
    if (endDate && t.created_at > endDate + "T23:59:59") return false;
    return true;
  });

  // Stats
  const stats = {
    total: trips.length,
    active: activeTrips.length,
    completed: trips.filter(t => t.status === 'completed').length,
    cancelled: trips.filter(t => t.status === 'cancelled').length
  };

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
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg font-['Manrope']">Portal da Empresa</h1>
              <p className="text-xs text-white/70">{company?.trade_name || company?.legal_name || user?.client_company_name || "Empresa"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-white/20 text-white border-0 hidden sm:flex">
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
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total</p>
                  <p className="text-2xl font-bold text-[#1e3a5f]">{stats.total}</p>
                </div>
                <Car className="w-8 h-8 text-[#1e3a5f]/20" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Ativas</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.active}</p>
                </div>
                <Clock className="w-8 h-8 text-amber-500/20" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Finalizadas</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-emerald-500/20" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Canceladas</p>
                  <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500/20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="active">Viagens Ativas ({activeTrips.length})</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Viagens em Andamento</CardTitle>
                <CardDescription>Acompanhe suas solicitações de transporte</CardDescription>
              </CardHeader>
              <CardContent>
                {activeTrips.length === 0 ? (
                  <div className="text-center py-12">
                    <Car className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500">Nenhuma viagem ativa no momento</p>
                    <Button 
                      className="mt-4 btn-navy"
                      onClick={() => navigate('/')}
                    >
                      Solicitar Táxi
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeTrips.map((trip) => (
                      <TripCard key={trip.id} trip={trip} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Histórico de Viagens</CardTitle>
                  <CardDescription>Todas as viagens finalizadas e canceladas</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-40"
                    />
                  </div>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-36"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-36"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {historyTrips.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500">Nenhuma viagem no histórico</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Solicitante</TableHead>
                        <TableHead>Passageiro</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead>Motorista</TableHead>
                        <TableHead>Voucher</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyTrips.map((trip) => {
                        const mainPassenger = trip.passengers?.[0] || {};
                        return (
                          <TableRow key={trip.id}>
                            <TableCell className="whitespace-nowrap">
                              {trip.created_at?.split('T')[0] || '-'}
                            </TableCell>
                            <TableCell>{trip.requester_name || '-'}</TableCell>
                            <TableCell>{mainPassenger.name || '-'}</TableCell>
                            <TableCell className="max-w-[150px] truncate">
                              {trip.destination_address || mainPassenger.address || '-'}
                            </TableCell>
                            <TableCell>
                              {trip.driver_name ? (
                                <div className="flex items-center gap-2">
                                  <span>{trip.driver_name}</span>
                                  {trip.driver_phone && (
                                    <a href={`tel:${trip.driver_phone}`} className="text-[#1e3a5f]">
                                      <Phone className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {trip.voucher_number ? (
                                <Badge variant="outline" className="font-mono text-xs">
                                  <Receipt className="w-3 h-3 mr-1" />
                                  {trip.voucher_number}
                                </Badge>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge className={STATUS_COLORS[trip.status]}>
                                {STATUS_LABELS[trip.status]}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function TripCard({ trip }) {
  const mainPassenger = trip.passengers?.[0] || {};
  
  return (
    <div className="p-4 bg-slate-50 rounded-xl">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-slate-800">{mainPassenger.name || trip.requester_name}</p>
          {trip.passenger_count > 1 && (
            <p className="text-xs text-slate-500">+{trip.passenger_count - 1} passageiros</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {trip.voucher_number && (
            <Badge variant="outline" className="font-mono text-xs">
              <Receipt className="w-3 h-3 mr-1" />
              {trip.voucher_number}
            </Badge>
          )}
          <Badge className={STATUS_COLORS[trip.status]}>
            {STATUS_LABELS[trip.status]}
          </Badge>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <MapPin className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span className="truncate">{trip.origin_address || "FIXAR"}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <span className="truncate">{trip.destination_address || mainPassenger.address || "N/A"}</span>
        </div>
        {trip.is_scheduled && (
          <div className="flex items-center gap-2 text-slate-600">
            <Calendar className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span>{trip.scheduled_date} às {trip.scheduled_time}</span>
          </div>
        )}
        {trip.driver_name && (
          <div className="flex items-center gap-2 text-slate-600">
            <Users className="w-4 h-4 text-purple-500 flex-shrink-0" />
            <span>{trip.driver_name}</span>
            {trip.driver_phone && (
              <a href={`tel:${trip.driver_phone}`} className="text-[#1e3a5f] ml-1">
                <Phone className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
