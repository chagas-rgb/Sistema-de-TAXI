import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
  User,
  Phone,
  Radio,
  Clock,
  CalendarIcon,
  Building,
  Navigation,
  LogOut,
  LayoutDashboard,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PassengerPortal() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // Requester name
  const [requesterName, setRequesterName] = useState("");
  
  // The logged-in user's company name (if any). Used to auto-fill "Origem" when
  // the "Empresa" option is selected, instead of the old hardcoded "FIXAR" text.
  const companyName = user?.client_company_name || user?.operator_name || "";
  
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
  // NEW: tracks whether a search attempt was made (success OR failure) so we
  // know when to reveal the editable fields for manual entry.
  const [mainSearched, setMainSearched] = useState(false);
  
  // Additional passengers state
  const [additionalPassengers, setAdditionalPassengers] = useState([]);
  
  // Default address checkbox
  const [useDefaultAddress, setUseDefaultAddress] = useState(true);

  // Pre-fill requester name with the logged-in user's name (still editable)
  useEffect(() => {
    if (user?.name && !requesterName) {
      setRequesterName(user.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // When the logged-in user has a company associated (client_company_name) and
  // "Origem" is set to "Empresa" (fixar), automatically use that company's name
  // as the origin address instead of the old placeholder text "FIXAR".
  useEffect(() => {
    if (originType === "fixar") {
      setOriginAddress(companyName || "FIXAR");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName]);

  // Search main passenger.
  // IMPORTANT: if the employee is NOT found in the database, we no longer
  // block the flow. Instead we reveal editable Name/Address/Phone fields so
  // the requester can type the information manually and still submit the
  // request normally (e.g. for a newly hired employee not yet registered).
  const searchMainPassenger = useCallback(async () => {
    if (!mainMatricula.trim()) {
      toast.error("Digite uma matrÃ­cula");
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await axios.get(`${API}/employees/search?matricula=${mainMatricula}`);
      setMainName(response.data.full_name);
      setMainAddress(response.data.default_address);
      setMainPhone(response.data.phone || "");
      setMainFound(true);
      setMainSearched(true);
      if (useDefaultAddress && destinationType === "cadastrado") {
        setDestinationAddress(response.data.default_address);
      }
      toast.success("FuncionÃ¡rio encontrado!");
    } catch (error) {
      // Not found: don't clear the possibility of continuing manually.
      setMainFound(false);
      setMainSearched(true);
      setMainName("");
      setMainAddress("");
      setMainPhone("");
      toast.error("FuncionÃ¡rio nÃ£o encontrado. Preencha os dados manualmente para continuar.");
    } finally {
      setIsSearching(false);
    }
  }, [mainMatricula, useDefaultAddress, destinationType]);

  // Search additional passenger. Same manual-fallback logic as main passenger.
  const searchAdditionalPassenger = async (index) => {
    const passenger = additionalPassengers[index];
    if (!passenger.matricula.trim()) {
      toast.error("Digite uma matrÃ­cula");
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
        found: true,
        searched: true
      };
      setAdditionalPassengers(updated);
      toast.success("Passageiro encontrado!");
    } catch (error) {
      const updated = [...additionalPassengers];
      updated[index] = {
        ...updated[index],
        full_name: "",
        address: "",
        phone: "",
        found: false,
        searched: true
      };
      setAdditionalPassengers(updated);
      toast.error("FuncionÃ¡rio nÃ£o encontrado. Preencha os dados manualmente.");
    }
  };

  // Add passenger
  const addPassenger = () => {
    if (additionalPassengers.length >= 5) {
      toast.error("MÃ¡ximo de 6 passageiros por veÃ­culo");
      return;
    }
    setAdditionalPassengers([...additionalPassengers, { matricula: "", full_name: "", address: "", phone: "", found: false, searched: false }]);
  };

  // Remove passenger
  const removePassenger = (index) => {
    setAdditionalPassengers(additionalPassengers.filter((_, i) => i !== index));
  };

  // Update passenger matricula
  const updatePassengerMatricula = (index, value) => {
    const updated = [...additionalPassengers];
    updated[index] = { ...updated[index], matricula: value, found: false, searched: false, full_name: "", address: "", phone: "" };
    setAdditionalPassengers(updated);
  };

  // Update additional passenger manual fields (name/address/phone)
  const updatePassengerField = (index, field, value) => {
    const updated = [...additionalPassengers];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalPassengers(updated);
  };

  // Handle origin type change
  const handleOriginTypeChange = (type) => {
    setOriginType(type);
    if (type === "fixar") {
      // Use the logged-in user's company name when available; otherwise fall
      // back to the legacy "FIXAR" placeholder (e.g. for users with no
      // company association, such as the platform owner).
      setOriginAddress(companyName || "FIXAR");
    } else {
      setOriginAddress("");
    }
  };

  // Handle destination type change
  const handleDestinationTypeChange = (type) => {
    setDestinationType(type);
    if (type === "cadastrado" && mainName) {
      setDestinationAddress(mainAddress);
    } else if (type === "outro") {
      setDestinationAddress("");
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Submit request
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!requesterName.trim()) {
      toast.error("Por favor, informe o nome do solicitante");
      return;
    }
    
    if (!mainSearched) {
      toast.error("Por favor, busque o passageiro principal primeiro");
      return;
    }

    if (!mainName.trim()) {
      toast.error("Por favor, informe o nome do passageiro principal");
      return;
    }
    
    if (originType === "outro" && !originAddress.trim()) {
      toast.error("Por favor, informe o endereÃ§o de origem");
      return;
    }
    
    if (!destinationAddress.trim()) {
      toast.error("Por favor, informe o endereÃ§o de destino");
      return;
    }
    
    if (isScheduled) {
      if (!scheduledDate) {
        toast.error("Por favor, selecione a data do agendamento");
        return;
      }
      if (!scheduledTime) {
        toast.error("Por favor, selecione o horÃ¡rio do agendamento");
        return;
      }
    }
    
    // Additional passengers just need a name filled in (either from a
    // successful search or typed manually) â€” they no longer need to have
    // been matched in the database.
    const incompletePassengers = additionalPassengers.filter(p => !p.full_name.trim());
    if (incompletePassengers.length > 0) {
      toast.error("Preencha o nome de todos os passageiros adicionados (busque ou informe manualmente)");
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
      const newRequestId = response.data.id;

      toast.success(isScheduled ? "Agendamento realizado com sucesso!" : "SolicitaÃ§Ã£o enviada com sucesso!");

      // Deferring the navigation to the next tick (setTimeout 0) lets the
      // toast finish mounting first and avoids a DOM race condition.
      setTimeout(() => {
        navigate(`/status/${newRequestId}`);
      }, 0);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao enviar solicitaÃ§Ã£o");
      setIsSubmitting(false);
    }
  };

  const totalPassengers = 1 + additionalPassengers.length;
  const isClientAdmin = user?.role === 'client_admin';

  // Submit is now enabled once a search attempt was made AND a name is filled
  // in (found in DB OR typed manually) â€” no longer strictly requires a DB match.
  const canSubmit = mainSearched && mainName.trim().length > 0 && !isSubmitting &&
    !(isScheduled && (!scheduledDate || !scheduledTime));

  return (
    <div className="min-h-screen arc-bg-pattern">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#1e3a5f] text-white shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/95 px-3 py-1.5 rounded-lg shadow-sm">
              <img src="/arc-logo.png" alt="ARC Transporte" className="h-7 w-auto" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight font-['Manrope']">ARC Transporte</h1>
              <p className="text-xs text-white/70">Sistema de TÃ¡xi Corporativo</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
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

            {/* Only client_admin sees the button to open the full admin dashboard
                (trip history, passenger registration, etc. at /portal) */}
            {isClientAdmin && (
              <Button 
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={() => navigate('/portal')}
                data-testid="admin-dashboard-link"
              >
                <LayoutDashboard className="w-4 h-4 mr-1" />
                Painel Administrativo
              </Button>
            )}

            <Button 
              variant="ghost" 
              size="sm"
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={handleLogout}
              data-testid="logout-link"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8 relative z-10">
        <Card className="border-0 shadow-[0_4px_20px_rgba(30,58,95,0.1)] animate-fade-in-up">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-['Manrope'] text-[#1e3a5f]">
              Solicitar TÃ¡xi
            </CardTitle>
            <CardDescription>
              Preencha os dados para solicitar um tÃ¡xi corporativo
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Requester Name */}
              <div className="space-y-4 p-4 bg-[#1e3a5f]/5 rounded-xl border border-[#1e3a5f]/10">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-5 h-5 text-[#1e3a5f]" />
                  <Label className="font-semibold text-[#1e3a5f]">Nome do Solicitante</Label>
                  <Badge variant="destructive" className="text-xs">ObrigatÃ³rio</Badge>
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
                    <Label className="text-sm text-slate-600">MatrÃ­cula</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        data-testid="main-matricula-input"
                        placeholder="Ex: 101 (opcional, se nÃ£o souber deixe em branco e preencha manualmente abaixo)"
                        value={mainMatricula}
                        onChange={(e) => {
                          setMainMatricula(e.target.value);
                          setMainFound(false);
                          setMainSearched(false);
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
                    {!mainSearched && (
                      <button
                        type="button"
                        className="text-xs text-[#1e3a5f] underline mt-1"
                        onClick={() => { setMainSearched(true); setMainFound(false); }}
                      >
                        NÃ£o sei a matrÃ­cula / preencher manualmente
                      </button>
                    )}
                  </div>
                  
                  {mainSearched && (
                    <div className={`animate-slide-in p-4 rounded-lg border ${mainFound ? 'bg-white border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                      {mainFound ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 mb-2">Encontrado</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 border-0 mb-2 flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3 h-3" /> NÃ£o encontrado â€” preencha manualmente
                        </Badge>
                      )}
                      <div className="mt-2 space-y-2">
                        <div>
                          <Label className="text-xs text-slate-600">Nome *</Label>
                          <Input
                            value={mainName}
                            onChange={(e) => setMainName(e.target.value)}
                            placeholder="Nome completo do passageiro"
                            className="h-10 mt-1"
                            data-testid="main-name-input"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-600">EndereÃ§o</Label>
                          <Input
                            value={mainAddress}
                            onChange={(e) => setMainAddress(e.target.value)}
                            placeholder="EndereÃ§o do passageiro"
                            className="h-10 mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-600">Telefone</Label>
                          <Input
                            value={mainPhone}
                            onChange={(e) => setMainPhone(e.target.value)}
                            placeholder="Telefone"
                            className="h-10 mt-1"
                          />
                        </div>
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
                            placeholder="MatrÃ­cula (opcional)"
                            value={passenger.matricula}
                            onChange={(e) => updatePassengerMatricula(index, e.target.value)}
                            className="h-10"
                          />
                          <Button type="button" onClick={() => searchAdditionalPassenger(index)} className="h-10 px-3 btn-navy">
                            <Search className="w-4 h-4" />
                          </Button>
                        </div>
                        {!passenger.searched && (
                          <button
                            type="button"
                            className="text-xs text-[#1e3a5f] underline mb-2"
                            onClick={() => updatePassengerField(index, "searched", true)}
                          >
                            NÃ£o sei a matrÃ­cula / preencher manualmente
                          </button>
                        )}
                        {passenger.searched && (
                          <div className={`mt-1 p-3 rounded-lg border ${passenger.found ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-200'}`}>
                            {passenger.found ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border-0 mb-2">Encontrado</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 border-0 mb-2 flex items-center gap-1 w-fit">
                                <AlertTriangle className="w-3 h-3" /> NÃ£o encontrado â€” preencha manualmente
                              </Badge>
                            )}
                            <div className="space-y-2">
                              <div>
                                <Label className="text-xs text-slate-600">Nome *</Label>
                                <Input
                                  value={passenger.full_name}
                                  onChange={(e) => updatePassengerField(index, "full_name", e.target.value)}
                                  placeholder="Nome completo"
                                  className="h-9 mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-slate-600">EndereÃ§o</Label>
                                <Input
                                  value={passenger.address}
                                  onChange={(e) => updatePassengerField(index, "address", e.target.value)}
                                  placeholder="EndereÃ§o"
                                  className="h-9 mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-slate-600">Telefone</Label>
                                <Input
                                  value={passenger.phone}
                                  onChange={(e) => updatePassengerField(index, "phone", e.target.value)}
                                  placeholder="Telefone"
                                  className="h-9 mt-1"
                                />
                              </div>
                            </div>
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

                {/* When "Empresa" is selected, show the actual company name of
                    the logged-in user that will be sent as the origin,
                    instead of silently sending the old placeholder "FIXAR". */}
                {originType === "fixar" && (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 animate-slide-in">
                    <p className="text-sm text-emerald-700 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {originAddress}
                    </p>
                  </div>
                )}

                {originType === "outro" && (
                  <Input
                    placeholder="Digite o endereÃ§o de origem"
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
                    EndereÃ§o Cadastrado
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

                {destinationType === "cadastrado" && mainName && (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 animate-slide-in">
                    <p className="text-sm text-emerald-700 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {mainAddress || "EndereÃ§o nÃ£o informado"}
                    </p>
                  </div>
                )}

                {destinationType === "outro" && (
                  <Input
                    placeholder="Digite o endereÃ§o de destino"
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
                        <Label className="text-sm text-slate-600">HorÃ¡rio</Label>
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
                          Agendado para: <strong>{format(scheduledDate, "dd/MM/yyyy")} Ã s {scheduledTime}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={!canSubmit}
                className="w-full h-14 text-lg font-semibold btn-navy rounded-xl"
                data-testid="submit-request-btn"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{isScheduled ? "Agendando..." : "Enviando..."}</>
                ) : (
                  <>{isScheduled ? "Agendar TÃ¡xi" : "Solicitar TÃ¡xi"}<ArrowRight className="w-5 h-5 ml-2" /></>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <footer className="mt-8 text-center text-sm text-slate-500">
          <p>ARC Transporte - Sistema de TÃ¡xi Corporativo</p>
        </footer>
      </main>
    </div>
  );
}