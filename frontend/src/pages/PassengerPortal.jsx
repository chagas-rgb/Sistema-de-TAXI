import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Phone
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PassengerPortal() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // Requester name (Nome do Solicitante)
  const [requesterName, setRequesterName] = useState("");
  
  // Main passenger state
  const [mainMatricula, setMainMatricula] = useState("");
  const [mainName, setMainName] = useState("");
  const [mainAddress, setMainAddress] = useState("");
  const [mainPhone, setMainPhone] = useState("");
  const [mainFound, setMainFound] = useState(false);
  
  // Additional passengers state
  const [additionalPassengers, setAdditionalPassengers] = useState([]);
  
  // Destination
  const [destination, setDestination] = useState("");
  const [useDefaultAddress, setUseDefaultAddress] = useState(true);

  // Search main passenger by matricula
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
      if (useDefaultAddress) {
        setDestination(response.data.default_address);
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
  }, [mainMatricula, useDefaultAddress]);

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

  // Add passenger slot
  const addPassenger = () => {
    if (additionalPassengers.length >= 3) {
      toast.error("Máximo de 4 passageiros por táxi");
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
    
    if (!destination.trim()) {
      toast.error("Por favor, informe o endereço de destino");
      return;
    }
    
    // Check if all additional passengers are found
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
        destination_address: destination
      };
      
      const response = await axios.post(`${API}/requests`, requestData);
      toast.success("Solicitação enviada com sucesso!");
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
          <Button 
            variant="ghost" 
            size="sm"
            className="text-white/80 hover:text-white hover:bg-white/10"
            onClick={() => navigate('/admin-control')}
            data-testid="admin-link"
          >
            <Shield className="w-4 h-4 mr-1" />
            Admin
          </Button>
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
              {/* Requester Name Section - FIRST */}
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
                <p className="text-xs text-slate-500">
                  Informe quem está realizando esta solicitação
                </p>
              </div>

              {/* Main Passenger Section */}
              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-[#1e3a5f] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <Label className="font-semibold text-[#1e3a5f]">Passageiro Principal</Label>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="mainMatricula" className="text-sm text-slate-600">Matrícula</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="mainMatricula"
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
                        {isSearching ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Search className="w-5 h-5" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {mainFound && (
                    <div className="animate-slide-in p-4 bg-white rounded-lg border border-emerald-200">
                      <div className="flex items-center gap-2 text-emerald-700 mb-3">
                        <Badge className="bg-emerald-100 text-emerald-700 border-0">
                          Encontrado
                        </Badge>
                      </div>
                      <p className="font-medium text-slate-800 text-lg" data-testid="main-name-display">
                        {mainName}
                      </p>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-slate-600 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          {mainAddress}
                        </p>
                        <p className="text-sm text-slate-600 flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-400" />
                          <span data-testid="main-phone-display">{mainPhone}</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Passengers Section */}
              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#1e3a5f]" />
                    <Label className="font-semibold text-[#1e3a5f]">
                      Passageiros Adicionais
                    </Label>
                    <Badge variant="secondary" className="ml-2">
                      {totalPassengers}/4
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPassenger}
                    disabled={additionalPassengers.length >= 3}
                    className="border-[#1e3a5f]/20 text-[#1e3a5f] hover:bg-[#1e3a5f]/5"
                    data-testid="add-passenger-btn"
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                </div>

                {additionalPassengers.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    Nenhum passageiro adicional
                  </p>
                ) : (
                  <div className="space-y-3">
                    {additionalPassengers.map((passenger, index) => (
                      <div 
                        key={index} 
                        className="p-4 bg-white rounded-lg border border-slate-200 animate-slide-in"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <Label className="text-sm font-medium text-slate-700">
                            Passageiro {index + 2}
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePassenger(index)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                            data-testid={`remove-passenger-${index}`}
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
                            data-testid={`passenger-${index}-matricula`}
                          />
                          <Button
                            type="button"
                            onClick={() => searchAdditionalPassenger(index)}
                            className="h-10 px-3 btn-navy"
                            data-testid={`search-passenger-${index}`}
                          >
                            <Search className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        {passenger.found && (
                          <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                            <p className="font-medium text-emerald-800" data-testid={`passenger-${index}-name`}>
                              {passenger.full_name}
                            </p>
                            <div className="mt-1 space-y-1">
                              <p className="text-xs text-emerald-700 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {passenger.address}
                              </p>
                              <p className="text-xs text-emerald-700 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                <span data-testid={`passenger-${index}-phone`}>{passenger.phone}</span>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Destination Section */}
              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-5 h-5 text-[#1e3a5f]" />
                  <Label className="font-semibold text-[#1e3a5f]">Destino</Label>
                </div>
                
                {mainFound && (
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="useDefault"
                      checked={useDefaultAddress}
                      onChange={(e) => {
                        setUseDefaultAddress(e.target.checked);
                        if (e.target.checked) {
                          setDestination(mainAddress);
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-[#1e3a5f] focus:ring-[#1e3a5f]"
                    />
                    <Label htmlFor="useDefault" className="text-sm text-slate-600 cursor-pointer">
                      Usar endereço padrão do passageiro
                    </Label>
                  </div>
                )}
                
                <Input
                  placeholder="Endereço de destino"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="h-12 text-base"
                  data-testid="destination-input"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting || !mainFound || !requesterName.trim()}
                className="w-full h-14 text-lg font-semibold btn-navy rounded-xl"
                data-testid="submit-request-btn"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    Solicitar Táxi
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-slate-500">
          <p>ARC Transporte - Sistema de Táxi Corporativo</p>
        </footer>
      </main>
    </div>
  );
}
