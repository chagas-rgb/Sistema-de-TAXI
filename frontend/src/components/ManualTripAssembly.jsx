import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Users, Car, Truck, Bus, Calendar, Clock, MapPin, Plus, Trash2, Sparkles,
  ArrowRight, GripVertical, ChevronDown, ChevronUp
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const VEHICLE_ICONS = {
  car: Car,
  taxi: Car,
  van: Truck,
  minibus: Bus,
  bus: Bus
};

const VEHICLE_LABELS = {
  car: "Carro",
  taxi: "Táxi",
  van: "Van/Spin",
  minibus: "Micro-ônibus",
  bus: "Ônibus"
};

export default function ManualTripAssembly({ companies, drivers, vehicles, onComplete, onClose }) {
  const { token } = useAuth();
  const fileInputRef = useRef(null);
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  
  // Step 1: Import preview
  const [preview, setPreview] = useState(null);
  
  // Step 2: Passenger pool and trip groups
  const [passengerPool, setPassengerPool] = useState([]);
  const [tripGroups, setTripGroups] = useState([]);
  const [expandedGroup, setExpandedGroup] = useState(null);
  
  // Filters
  const [filterCity, setFilterCity] = useState("");
  const [filterNeighborhood, setFilterNeighborhood] = useState("");
  const [filterTime, setFilterTime] = useState("");
  
  // Smart assembly suggestions
  const [suggestions, setSuggestions] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Validation
  const [validationErrors, setValidationErrors] = useState([]);

  // Available drivers and vehicles filtered by operator
  const availableDrivers = drivers.filter(d => d.status === 'available');
  const availableVehicles = vehicles.filter(v => v.status === 'available');

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!selectedCompanyId) {
      toast.error("Selecione uma empresa primeiro");
      return;
    }
    
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post(
        `${API}/import/preview-spreadsheet?client_company_id=${selectedCompanyId}`,
        formData,
        { headers: { ...headers, 'Content-Type': 'multipart/form-data' } }
      );
      
      setPreview(response.data);
      
      // Convert preview to passenger pool
      const pool = response.data.rows
        .filter(r => r.is_valid)
        .map((r, idx) => ({
          id: `p-${idx}`,
          name: r.passenger_name,
          phone: r.passenger_phone,
          address: r.passenger_address,
          neighborhood: r.passenger_neighborhood,
          city: r.passenger_city,
          time: r.pickup_time,
          destination: r.destination,
          passenger_id: r.passenger_id,
          assigned: false
        }));
      
      setPassengerPool(pool);
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao processar arquivo");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const addTripGroup = () => {
    const newGroup = {
      id: `group-${Date.now()}`,
      passengers: [],
      vehicleId: "",
      driverId: "",
      scheduledTime: "",
      destination: ""
    };
    setTripGroups([...tripGroups, newGroup]);
    setExpandedGroup(newGroup.id);
  };

  const removeTripGroup = (groupId) => {
    const group = tripGroups.find(g => g.id === groupId);
    if (group) {
      // Return passengers to pool
      setPassengerPool(prev => [
        ...prev,
        ...group.passengers.map(p => ({ ...p, assigned: false }))
      ]);
    }
    setTripGroups(tripGroups.filter(g => g.id !== groupId));
  };

  const addPassengerToGroup = (groupId, passenger) => {
    // Check vehicle capacity
    const group = tripGroups.find(g => g.id === groupId);
    if (group.vehicleId) {
      const vehicle = vehicles.find(v => v.id === group.vehicleId);
      if (vehicle && group.passengers.length >= vehicle.capacity) {
        toast.error(`Veículo ${vehicle.plate} tem capacidade máxima de ${vehicle.capacity} passageiros`);
        return;
      }
    }
    
    // Remove from pool
    setPassengerPool(prev => prev.filter(p => p.id !== passenger.id));
    
    // Add to group
    setTripGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          passengers: [...g.passengers, { ...passenger, assigned: true }],
          destination: g.destination || passenger.destination,
          scheduledTime: g.scheduledTime || passenger.time
        };
      }
      return g;
    }));
  };

  const removePassengerFromGroup = (groupId, passengerId) => {
    const group = tripGroups.find(g => g.id === groupId);
    const passenger = group?.passengers.find(p => p.id === passengerId);
    
    if (passenger) {
      // Return to pool
      setPassengerPool(prev => [...prev, { ...passenger, assigned: false }]);
      
      // Remove from group
      setTripGroups(prev => prev.map(g => {
        if (g.id === groupId) {
          return {
            ...g,
            passengers: g.passengers.filter(p => p.id !== passengerId)
          };
        }
        return g;
      }));
    }
  };

  const updateTripGroup = (groupId, field, value) => {
    setTripGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return { ...g, [field]: value };
      }
      return g;
    }));
  };

  const getVehicleCapacity = (vehicleId) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle?.capacity || 4;
  };

  const fetchSmartSuggestions = async () => {
    if (passengerPool.length === 0 && tripGroups.every(g => g.passengers.length === 0)) {
      toast.error("Nenhum passageiro para montar viagens");
      return;
    }
    
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      // Combine pool and already assigned passengers
      const allPassengers = [
        ...passengerPool,
        ...tripGroups.flatMap(g => g.passengers)
      ];
      
      const response = await axios.post(
        `${API}/import/smart-assembly`,
        {
          passengers: allPassengers.map(p => ({
            passenger_name: p.name,
            passenger_phone: p.phone,
            passenger_address: p.address,
            passenger_neighborhood: p.neighborhood,
            passenger_city: p.city,
            pickup_time: p.time,
            destination: p.destination,
            passenger_id: p.passenger_id
          })),
          client_company_id: selectedCompanyId,
          scheduled_date: scheduledDate
        },
        { headers }
      );
      
      setSuggestions(response.data);
      setShowSuggestions(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro na montagem inteligente");
    } finally {
      setLoading(false);
    }
  };

  const applySmartSuggestions = () => {
    if (!suggestions) return;
    
    // Clear current groups and pool
    const allPassengers = [
      ...passengerPool,
      ...tripGroups.flatMap(g => g.passengers)
    ];
    
    // Create new groups from suggestions
    const newGroups = suggestions.suggestions.map((s, idx) => ({
      id: `group-auto-${idx}`,
      passengers: s.passengers.map((p, pidx) => {
        const match = allPassengers.find(ap => ap.name === p.name) || {
          id: `auto-p-${idx}-${pidx}`,
          name: p.name,
          phone: p.phone,
          address: p.address,
          neighborhood: s.neighborhood,
          city: s.city,
          time: s.scheduled_time,
          destination: s.destination
        };
        return { ...match, assigned: true };
      }),
      vehicleId: "",
      driverId: s.driver_id || "",
      scheduledTime: s.scheduled_time,
      destination: s.destination
    }));
    
    setTripGroups(newGroups);
    setPassengerPool([]);
    setShowSuggestions(false);
    toast.success("Sugestões aplicadas! Você pode ajustar manualmente.");
  };

  const validateTrips = () => {
    const errors = [];
    
    tripGroups.forEach((group, idx) => {
      const groupNum = idx + 1;
      
      if (group.passengers.length === 0) {
        errors.push(`Viagem ${groupNum}: Nenhum passageiro`);
      }
      
      if (!group.vehicleId) {
        errors.push(`Viagem ${groupNum}: Nenhum veículo selecionado`);
      } else {
        const vehicle = vehicles.find(v => v.id === group.vehicleId);
        if (vehicle && group.passengers.length > vehicle.capacity) {
          errors.push(`Viagem ${groupNum}: ${group.passengers.length} passageiros excedem capacidade do veículo (${vehicle.capacity})`);
        }
      }
      
      if (!group.driverId) {
        errors.push(`Viagem ${groupNum}: Nenhum motorista selecionado`);
      }
      
      // Check driver conflicts
      const driverTrips = tripGroups.filter(g => g.driverId === group.driverId && g.id !== group.id);
      if (driverTrips.length > 0 && group.scheduledTime) {
        const conflict = driverTrips.find(t => t.scheduledTime === group.scheduledTime);
        if (conflict) {
          errors.push(`Viagem ${groupNum}: Motorista já atribuído a outra viagem no mesmo horário`);
        }
      }
    });
    
    // Check for duplicate passengers
    const allAssigned = tripGroups.flatMap(g => g.passengers);
    const seen = new Set();
    allAssigned.forEach(p => {
      if (seen.has(p.id)) {
        errors.push(`Passageiro duplicado: ${p.name}`);
      }
      seen.add(p.id);
    });
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleConfirm = async () => {
    if (!validateTrips()) {
      toast.error("Corrija os erros antes de confirmar");
      return;
    }
    
    if (!scheduledDate) {
      toast.error("Selecione a data do agendamento");
      return;
    }
    
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const tripsToCreate = tripGroups.map(group => {
        const vehicle = vehicles.find(v => v.id === group.vehicleId);
        const driver = drivers.find(d => d.id === group.driverId);
        
        return {
          passengers: group.passengers.map(p => ({
            name: p.name,
            phone: p.phone,
            address: p.address,
            passenger_id: p.passenger_id
          })),
          vehicle_type: vehicle?.vehicle_type || 'car',
          driver_id: group.driverId,
          driver_name: driver?.name || '',
          scheduled_time: group.scheduledTime,
          destination: group.destination,
          city: group.passengers[0]?.city || '',
          neighborhood: group.passengers[0]?.neighborhood || ''
        };
      });
      
      const response = await axios.post(
        `${API}/import/confirm-trips`,
        {
          suggestions: tripsToCreate,
          client_company_id: selectedCompanyId,
          scheduled_date: scheduledDate
        },
        { headers }
      );
      
      toast.success(response.data.message);
      if (onComplete) onComplete();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao criar viagens");
    } finally {
      setLoading(false);
    }
  };

  // Filtered pool
  const filteredPool = passengerPool.filter(p => {
    if (filterCity && !p.city?.toLowerCase().includes(filterCity.toLowerCase())) return false;
    if (filterNeighborhood && !p.neighborhood?.toLowerCase().includes(filterNeighborhood.toLowerCase())) return false;
    if (filterTime && !p.time?.includes(filterTime)) return false;
    return true;
  });

  // Get unique values for filters
  const cities = [...new Set(passengerPool.map(p => p.city).filter(Boolean))];
  const neighborhoods = [...new Set(passengerPool.map(p => p.neighborhood).filter(Boolean))];
  const times = [...new Set(passengerPool.map(p => p.time).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 1 ? 'bg-[#1e3a5f] text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
        <div className={`w-16 h-1 ${step > 1 ? 'bg-[#1e3a5f]' : 'bg-slate-200'}`} />
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 2 ? 'bg-[#1e3a5f] text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#1e3a5f]" />
              Importar Planilha
            </CardTitle>
            <CardDescription>
              Faça upload de uma planilha com os passageiros para montar viagens manualmente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.trade_name || c.legal_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data do Agendamento *</Label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
            </div>
            
            <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center bg-slate-50">
              <Upload className="w-12 h-12 mx-auto text-slate-400 mb-3" />
              <p className="text-sm text-slate-600 mb-4">
                Arraste o arquivo CSV ou clique para selecionar
              </p>
              <input 
                type="file" 
                ref={fileInputRef} 
                accept=".csv" 
                onChange={handleFileSelect} 
                className="hidden" 
              />
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || !selectedCompanyId || !scheduledDate}
                className="btn-navy"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Selecionar Arquivo
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Manual Assembly */}
      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Passenger Pool */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Passageiros Disponíveis</CardTitle>
                  <CardDescription>{filteredPool.length} de {passengerPool.length}</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchSmartSuggestions}
                  disabled={loading}
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  Sugestão Auto
                </Button>
              </div>
              
              {/* Filters */}
              <div className="flex gap-2 mt-3">
                <Select value={filterCity} onValueChange={setFilterCity}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Cidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterNeighborhood} onValueChange={setFilterNeighborhood}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Bairro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {neighborhoods.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterTime} onValueChange={setFilterTime}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Hora" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {times.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-y-auto">
              {filteredPool.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  {passengerPool.length === 0 ? "Todos os passageiros foram atribuídos" : "Nenhum passageiro com os filtros"}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPool.map((passenger) => (
                    <div 
                      key={passenger.id}
                      className="p-3 bg-slate-50 rounded-lg text-sm cursor-grab hover:bg-slate-100"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{passenger.name}</span>
                        {passenger.time && <Badge variant="outline" className="text-xs">{passenger.time}</Badge>}
                      </div>
                      <div className="text-xs text-slate-500 space-y-0.5">
                        {passenger.address && <p className="truncate">{passenger.address}</p>}
                        <p>{[passenger.neighborhood, passenger.city].filter(Boolean).join(", ")}</p>
                      </div>
                      <div className="mt-2 flex gap-1 flex-wrap">
                        {tripGroups.map(g => (
                          <Button
                            key={g.id}
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs"
                            onClick={() => addPassengerToGroup(g.id, passenger)}
                          >
                            + Viagem {tripGroups.indexOf(g) + 1}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Trip Groups */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Viagens</CardTitle>
                  <CardDescription>{tripGroups.length} viagem(s) criada(s)</CardDescription>
                </div>
                <Button onClick={addTripGroup} className="btn-navy" size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Nova Viagem
                </Button>
              </div>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-y-auto space-y-3">
              {tripGroups.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  Clique em "Nova Viagem" para começar
                </div>
              ) : (
                tripGroups.map((group, idx) => {
                  const vehicle = vehicles.find(v => v.id === group.vehicleId);
                  const driver = drivers.find(d => d.id === group.driverId);
                  const isExpanded = expandedGroup === group.id;
                  
                  return (
                    <div 
                      key={group.id}
                      className={`border rounded-xl overflow-hidden ${isExpanded ? 'border-[#1e3a5f]' : 'border-slate-200'}`}
                    >
                      {/* Header */}
                      <div 
                        className="p-3 bg-slate-50 flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#1e3a5f]">Viagem {idx + 1}</span>
                          <Badge variant="secondary">
                            {group.passengers.length}/{vehicle?.capacity || '?'} pass.
                          </Badge>
                          {group.scheduledTime && (
                            <Badge variant="outline">{group.scheduledTime}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-red-500"
                            onClick={(e) => { e.stopPropagation(); removeTripGroup(group.id); }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                      
                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="p-3 space-y-3">
                          {/* Vehicle & Driver Selection */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Veículo</Label>
                              <Select 
                                value={group.vehicleId} 
                                onValueChange={(v) => updateTripGroup(group.id, 'vehicleId', v)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableVehicles.map(v => (
                                    <SelectItem key={v.id} value={v.id}>
                                      {v.plate} ({VEHICLE_LABELS[v.vehicle_type]}) - {v.capacity} lug.
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Motorista</Label>
                              <Select 
                                value={group.driverId} 
                                onValueChange={(v) => updateTripGroup(group.id, 'driverId', v)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableDrivers.map(d => (
                                    <SelectItem key={d.id} value={d.id}>
                                      {d.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Horário</Label>
                              <Input 
                                type="time"
                                value={group.scheduledTime}
                                onChange={(e) => updateTripGroup(group.id, 'scheduledTime', e.target.value)}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Destino</Label>
                              <Input 
                                value={group.destination}
                                onChange={(e) => updateTripGroup(group.id, 'destination', e.target.value)}
                                className="h-8 text-xs"
                                placeholder="Endereço destino"
                              />
                            </div>
                          </div>
                          
                          {/* Passengers */}
                          <div>
                            <Label className="text-xs">Passageiros ({group.passengers.length})</Label>
                            <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                              {group.passengers.length === 0 ? (
                                <p className="text-xs text-slate-400 py-2">Adicione passageiros da lista à esquerda</p>
                              ) : (
                                group.passengers.map(p => (
                                  <div key={p.id} className="flex items-center justify-between p-1.5 bg-blue-50 rounded text-xs">
                                    <span>{p.name}</span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 w-5 p-0 text-red-500"
                                      onClick={() => removePassengerFromGroup(group.id, p.id)}
                                    >
                                      <XCircle className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="p-4 bg-red-50 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
            <AlertTriangle className="w-4 h-4" />
            Erros de Validação
          </div>
          <ul className="text-sm text-red-600 space-y-1">
            {validationErrors.map((err, i) => (
              <li key={i}>• {err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {step === 2 && (
        <div className="flex justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Voltar
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
          <Button 
            onClick={handleConfirm}
            disabled={loading || tripGroups.length === 0}
            className="btn-navy"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirmar {tripGroups.length} Viagem(s)
              </>
            )}
          </Button>
        </div>
      )}

      {/* Smart Suggestions Modal */}
      <Dialog open={showSuggestions} onOpenChange={setShowSuggestions}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Sugestão Automática
            </DialogTitle>
            <DialogDescription>
              {suggestions?.suggestions.length || 0} viagens sugeridas com base em cidade, bairro e horário
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {suggestions?.suggestions.map((s, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-lg text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">Viagem {i + 1}</span>
                  <Badge variant="secondary">{s.passenger_count} pass.</Badge>
                </div>
                <p className="text-xs text-slate-500">
                  {s.city} {s.neighborhood && `- ${s.neighborhood}`} • {s.scheduled_time || 'Horário variado'}
                </p>
              </div>
            ))}
          </div>
          {suggestions?.warnings.length > 0 && (
            <div className="p-2 bg-amber-50 rounded text-xs text-amber-700">
              {suggestions.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuggestions(false)}>
              Cancelar
            </Button>
            <Button onClick={applySmartSuggestions} className="btn-navy">
              Aplicar Sugestões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
