import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Car, 
  Search, 
  UserPlus, 
  X, 
  MapPin, 
  Users, 
  ArrowRight,
  Loader2,
  Shield,
  User,
  Phone,
  Radio,
  Clock,
  CalendarIcon,
  Building,
  Navigation,
  LogIn
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PassengerPortal() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // Requester name
  const [requesterName, setRequesterName] = useState("");
  
  // Origin state
  const [originType, setOriginType] = useState("fixar"); // fixar, outro
  const [originAddress, setOriginAddress] = useState("FIXAR");
  
  // Destination state
  const [destinationType, setDestinationType] = useState("cadastrado"); // cadastrado, outro
  const [destinationAddress, setDestinationAddress] = useState("");
  
  // Scheduling state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(null);
  const [scheduledTime, setScheduledTime] = useState("");
  
  // Main passenger state
  const [mainMatricula, setMainMatricula] = useState("");
  const [mainName, setMainName] = useState("");
  const [mainAddress, setMainAddress] = useState("");
  const [mainPhone, setMainPhone] = useState("");
  const [mainFound, setMainFound] = useState(false);
  
  // Additional passengers state
  const [additionalPassengers, setAdditionalPassengers] = useState([]);
  
  // Default address checkbox
  const [useDefaultAddress, setUseDefaultAddress] = useState(true);

  // Search main passenger
  const searchMainPassenger = useCallback(async () => {
    if (!mainMatricula.trim()) {
      toast.error("Digite uma matrícula");
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await axios.get(`${API}/employees/search?matricula=${mainMatricula}`);
      setMainName(response.data.full_name);
      setMainAddress(response.data.default_address);
      setMainPhone(response.data.phone || "");
      setMainFound(true);
      if (useDefaultAddress && destinationType === "cadastrado") {
        setDestinationAddress(response.data.default_address);
      }
      toast.success("Funcionário encontrado!");
    } catch (error) {
      setMainName("");
      setMainAddress("");
      setMainPhone("");
      setMainFound(false);
      toast.error("Funcionário não encontrado");
    } finally {
      setIsSearching(false);
    }
  }, [mainMatricula, useDefaultAddress, destinationType]);

  // Search additional passenger
  const searchAdditionalPassenger = async (index) => {
    const passenger = additionalPassengers[index];
    if (!passenger.matricula.trim()) {
      toast.error("Digite uma matrícula");
      return;
    }
    
    try {
      const response = await axios.get(`${API}/employees/search?matricula=${passenger.matricula}`);
      const updated = [...additionalPassengers];
      updated[index] = {
        ...updated[index],
        full_name: response.data.full_name,
        address: response.data.default_address,
        phone: response.data.phone || "",
        found: true
      };
      setAdditionalPassengers(updated);
      toast.success("Passageiro encontrado!");
    } catch (error) {
      const updated = [...additionalPassengers];
      updated[index] = { ...updated[index], full_name: "", address: "", phone: "", found: false };
      setAdditionalPassengers(updated);
      toast.error("Funcionário não encontrado");
    }
  };

  // Add passenger
  const addPassenger = () => {
    if (additionalPassengers.length >= 5) {
      toast.error("Máximo de 6 passageiros por veículo");
      return;
    }
    setAdditionalPassengers([...additionalPassengers, { matricula: "", full_name: "", address: "", phone: "", found: false }]);
  };

  // Remove passenger
  const removePassenger = (index) => {
    setAdditionalPassengers(additionalPassengers.filter((_, i) => i !== index));
  };

  // Update passenger matricula
  const updatePassengerMatricula = (index, value) => {
    const updated = [...additionalPassengers];
    updated[index] = { ...updated[index], matricula: value, found: false, full_name: "", address: "", phone: "" };
    setAdditionalPassengers(updated);
  };

  // Handle origin type change
  const handleOriginTypeChange = (type) => {
    setOriginType(type);
    if (type === "fixar") {
      setOriginAddress("FIXAR");
    } else {
      setOriginAddress("");
    }
  };

  // Handle destination type change
  const handleDestinationTypeChange = (type) => {
    setDestinationType(type);
    if (type === "cadastrado" && mainFound) {
      setDestinationAddress(mainAddress);
    } else if (type === "outro") {
      setDestinationAddress("");
    }
  };

  // Submit request
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!requesterName.trim()) {
      toast.error("Por favor, informe o nome do solicitante");
      return;
    }
    
    if (!mainFound) {
      toast.error("Por favor, busque o passageiro principal primeiro");
      return;
    }
    
    if (originType === "outro" && !originAddress.trim()) {
      toast.error("Por favor, informe o endereço de origem");
      return;
    }
    
    if (!destinationAddress.trim()) {
      toast.error("Por favor, informe o endereço de destino");
      return;
    }
    
    if (isScheduled) {
      if (!scheduledDate) {
        toast.error("Por favor, selecione a data do agendamento");
        return;
      }
      if (!scheduledTime) {
        toast.error("Por favor, selecione o horário do agendamento");
        return;
      }
    }
    
    const unfoundPassengers = additionalPassengers.filter(p => !p.found);
    if (unfoundPassengers.length > 0) {
      toast.error("Todos os passageiros adicionais devem ser validados");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const requestData = {
        requester_name: requesterName,
        main_passenger: {
          matricula: mainMatricula,
          full_name: mainName,
          address: mainAddress,
          phone: mainPhone
        },
        additional_passengers: additionalPassengers.map(p => ({
          matricula: p.matricula,
          full_name: p.full_name,
          address: p.address,
          phone: p.phone
        })),
        origin_type: originType,
        origin_address: originAddress,
        destination_type: destinationType,
        destination_address: destinationAddress,
        is_scheduled: isScheduled,
        scheduled_date: isScheduled && scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : "",
        scheduled_time: isScheduled ? scheduledTime : ""
      };
      
      const response = await axios.post(`${API}/requests`, requestData);
      toast.success(isScheduled ? "Agendamento realizado com sucesso!" : "Solicitação enviada com sucesso!");
      navigate(`/status/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao enviar solicitação");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPassengers = 1 + additionalPassengers.length;

  return (
    <div className="min-h-screen arc-bg-pattern">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#1e3a5f] text-white shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
              <Car className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight font-['Manrope']">ARC Transporte</h1>
              <p className="text-xs text-white/70">Sistema de Táxi Corporativo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => navigate('/acompanhamento')}
              data-testid="tracking-link"
            >
              <Radio className="w-4 h-4 mr-1" />
              Acompanhar
            </Button>
            <Button 
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border-0"
              onClick={() => navigate('/login')}
              data-testid="login-link"
            >
              <LogIn className="w-4 h-4 mr-1" />
              Entrar
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8 relative z-10">
        <Card className="border-0 shadow-[0_4px_20px_rgba(30,58,95,0.1)] animate-fade-in-up">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-['Manrope'] text-[#1e3a5f]">
              Solicitar Táxi
            </CardTitle>
            <CardDescription>
              Preencha os dados para solicitar um táxi corporativo
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Requester Name */}
              <div className="space-y-4 p-4 bg-[#1e3a5f]/5 rounded-xl border border-[#1e3a5f]/10">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-5 h-5 text-[#1e3a5f]" />
                  <Label className="font-semibold text-[#1e3a5f]">Nome do Solicitante</Label>
                  <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                </div>
                <Input
                  placeholder="Digite seu nome completo"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  className="h-12 text-base"
                  data-testid="requester-name-input"
                />
              </div>

              {/* Main Passenger */}
              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-[#1e3a5f] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                  <Label className="font-semibold text-[#1e3a5f]">Passageiro Principal</Label>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-slate-600">Matrícula</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        data-testid="main-matricula-input"
                        placeholder="Ex: 101"
                        value={mainMatricula}
                        onChange={(e) => {
                          setMainMatricula(e.target.value);
                          setMainFound(false);
                          setMainName("");
                          setMainAddress("");
                          setMainPhone("");
                        }}
                        className="h-12 text-base"
                      />
                      <Button
                        type="button"
                        onClick={searchMainPassenger}
                        disabled={isSearching}
                        className="h-12 px-4 btn-navy"
                        data-testid="search-main-btn"
                      >
                        {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                      </Button>
                    </div>
                  </div>
                  
                  {mainFound && (
                    <div className="animate-slide-in p-4 bg-white rounded-lg border border-emerald-200">
                      <Badge className="bg-emerald-100 text-emerald-700 border-0 mb-2">Encontrado</Badge>
                      <p className="font-medium text-slate-800 text-lg">{mainName}</p>
                      <div className="mt-2 space-y-1 text-sm text-slate-600">
                        <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" />{mainAddress}</p>
                        <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" />{mainPhone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Passengers */}
              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#1e3a5f]" />
                    <Label className="font-semibold text-[#1e3a5f]">Passageiros Adicionais</Label>
                    <Badge variant="secondary" className="ml-2">{totalPassengers}/6</Badge>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPassenger}
                    disabled={additionalPassengers.length >= 5}
                    className="border-[#1e3a5f]/20 text-[#1e3a5f]"
                    data-testid="add-passenger-btn"
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                </div>

                {additionalPassengers.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">Nenhum passageiro adicional</p>
                ) : (
                  <div className="space-y-3">
                    {additionalPassengers.map((passenger, index) => (
                      <div key={index} className="p-4 bg-white rounded-lg border border-slate-200 animate-slide-in">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="text-sm font-medium text-slate-700">Passageiro {index + 2}</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePassenger(index)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex gap-2 mb-2">
                          <Input
                            placeholder="Matrícula"
                            value={passenger.matricula}
                            onChange={(e) => updatePassengerMatricula(index, e.target.value)}
                            className="h-10"
                          />
                          <Button type="button" onClick={() => searchAdditionalPassenger(index)} className="h-10 px-3 btn-navy">
                            <Search className="w-4 h-4" />
                          </Button>
                        </div>
                        {passenger.found && (
                          <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                            <p className="font-medium text-emerald-800">{passenger.full_name}</p>
                            <p className="text-xs text-emerald-700 flex items-center gap-1 mt-1"><Phone className="w-3 h-3" />{passenger.phone}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Origin Section */}
              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <Building className="w-5 h-5 text-[#1e3a5f]" />
                  <Label className="font-semibold text-[#1e3a5f]">Origem</Label>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={originType === "fixar" ? "default" : "outline"}
                    onClick={() => handleOriginTypeChange("fixar")}
                    className={originType === "fixar" ? "flex-1 btn-navy" : "flex-1"}
                    data-testid="origin-fixar-btn"
                  >
                    Empresa
                  </Button>
                  <Button
                    type="button"
                    variant={originType === "outro" ? "default" : "outline"}
                    onClick={() => handleOriginTypeChange("outro")}
                    className={originType === "outro" ? "flex-1 btn-navy" : "flex-1"}
                    data-testid="origin-outro-btn"
                  >
                    Outro
                  </Button>
                </div>

                {originType === "outro" && (
                  <Input
                    placeholder="Digite o endereço de origem"
                    value={originAddress}
                    onChange={(e) => setOriginAddress(e.target.value)}
                    className="h-12 text-base animate-slide-in"
                    data-testid="origin-address-input"
                  />
                )}
              </div>

              {/* Destination Section */}
              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <Navigation className="w-5 h-5 text-[#1e3a5f]" />
                  <Label className="font-semibold text-[#1e3a5f]">Destino</Label>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={destinationType === "cadastrado" ? "default" : "outline"}
                    onClick={() => handleDestinationTypeChange("cadastrado")}
                    className={destinationType === "cadastrado" ? "flex-1 btn-navy" : "flex-1"}
                    data-testid="dest-cadastrado-btn"
                  >
                    Endereço Cadastrado
                  </Button>
                  <Button
                    type="button"
                    variant={destinationType === "outro" ? "default" : "outline"}
                    onClick={() => handleDestinationTypeChange("outro")}
                    className={destinationType === "outro" ? "flex-1 btn-navy" : "flex-1"}
                    data-testid="dest-outro-btn"
                  >
                    Outro
                  </Button>
                </div>

                {destinationType === "cadastrado" && mainFound && (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 animate-slide-in">
                    <p className="text-sm text-emerald-700 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {mainAddress}
                    </p>
                  </div>
                )}

                {destinationType === "outro" && (
                  <Input
                    placeholder="Digite o endereço de destino"
                    value={destinationAddress}
                    onChange={(e) => setDestinationAddress(e.target.value)}
                    className="h-12 text-base animate-slide-in"
                    data-testid="destination-address-input"
                  />
                )}
              </div>

              {/* Scheduling Section */}
              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-5 h-5 text-[#1e3a5f]" />
                  <Label className="font-semibold text-[#1e3a5f]">Agendamento</Label>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={!isScheduled ? "default" : "outline"}
                    onClick={() => setIsScheduled(false)}
                    className={!isScheduled ? "flex-1 btn-navy" : "flex-1"}
                    data-testid="immediate-btn"
                  >
                    <Car className="w-4 h-4 mr-2" />
                    Solicitar Agora
                  </Button>
                  <Button
                    type="button"
                    variant={isScheduled ? "default" : "outline"}
                    onClick={() => setIsScheduled(true)}
                    className={isScheduled ? "flex-1 btn-navy" : "flex-1"}
                    data-testid="schedule-btn"
                  >
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    Agendar para Depois
                  </Button>
                </div>

                {isScheduled && (
                  <div className="mt-4 space-y-4 animate-slide-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600">Data</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={`w-full h-12 justify-start text-left ${!scheduledDate && "text-muted-foreground"}`}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {scheduledDate ? format(scheduledDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={scheduledDate}
                              onSelect={setScheduledDate}
                              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                              locale={ptBR}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600">Horário</Label>
                        <Input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="h-12"
                        />
                      </div>
                    </div>
                    {scheduledDate && scheduledTime && (
                      <div className="p-3 bg-[#1e3a5f]/5 rounded-lg">
                        <p className="text-sm text-[#1e3a5f] flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4" />
                          Agendado para: <strong>{format(scheduledDate, "dd/MM/yyyy")} às {scheduledTime}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting || !mainFound || !requesterName.trim() || (isScheduled && (!scheduledDate || !scheduledTime))}
                className="w-full h-14 text-lg font-semibold btn-navy rounded-xl"
                data-testid="submit-request-btn"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{isScheduled ? "Agendando..." : "Enviando..."}</>
                ) : (
                  <>{isScheduled ? "Agendar Táxi" : "Solicitar Táxi"}<ArrowRight className="w-5 h-5 ml-2" /></>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <footer className="mt-8 text-center text-sm text-slate-500">
          <p>ARC Transporte - Sistema de Táxi Corporativo</p>
        </footer>
      </main>
    </div>
  );
}
