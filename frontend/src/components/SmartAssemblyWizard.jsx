import { useState, useRef } from "react";
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
  Users, Car, Truck, Bus, Calendar, Clock, MapPin, ChevronRight, Sparkles
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
  van: "Van",
  minibus: "Micro-ônibus",
  bus: "Ônibus"
};

export default function SmartAssemblyWizard({ companies, onComplete }) {
  const { token } = useAuth();
  const fileInputRef = useRef(null);
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  
  // Step 2: Preview
  const [preview, setPreview] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  
  // Step 3: Suggestions
  const [suggestions, setSuggestions] = useState(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState([]);
  
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
      // Select all valid rows by default
      setSelectedRows(response.data.rows.filter(r => r.is_valid).map(r => r.row_num));
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao processar arquivo");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  
  const handleAssemble = async () => {
    if (selectedRows.length === 0) {
      toast.error("Selecione pelo menos um passageiro");
      return;
    }
    if (!scheduledDate) {
      toast.error("Selecione a data do agendamento");
      return;
    }
    
    const selectedPassengers = preview.rows.filter(r => selectedRows.includes(r.row_num));
    
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post(
        `${API}/import/smart-assembly`,
        {
          passengers: selectedPassengers,
          client_company_id: selectedCompanyId,
          scheduled_date: scheduledDate
        },
        { headers }
      );
      
      setSuggestions(response.data);
      // Select all suggestions by default
      setSelectedSuggestions(response.data.suggestions.map(s => s.id));
      setStep(3);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro na montagem inteligente");
    } finally {
      setLoading(false);
    }
  };
  
  const handleConfirm = async () => {
    if (selectedSuggestions.length === 0) {
      toast.error("Selecione pelo menos uma viagem");
      return;
    }
    
    const selectedTrips = suggestions.suggestions.filter(s => selectedSuggestions.includes(s.id));
    
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post(
        `${API}/import/confirm-trips`,
        {
          suggestions: selectedTrips,
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
  
  const toggleRow = (rowNum) => {
    setSelectedRows(prev => 
      prev.includes(rowNum) 
        ? prev.filter(r => r !== rowNum)
        : [...prev, rowNum]
    );
  };
  
  const toggleSuggestion = (id) => {
    setSelectedSuggestions(prev => 
      prev.includes(id) 
        ? prev.filter(s => s !== id)
        : [...prev, id]
    );
  };
  
  const toggleAllRows = () => {
    if (selectedRows.length === preview?.rows.filter(r => r.is_valid).length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(preview?.rows.filter(r => r.is_valid).map(r => r.row_num) || []);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
              step >= s ? 'bg-[#1e3a5f] text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {s}
            </div>
            {s < 3 && (
              <div className={`w-16 h-1 mx-2 ${step > s ? 'bg-[#1e3a5f]' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>
      
      <div className="text-center text-sm text-slate-500 mb-6">
        {step === 1 && "Selecione a empresa e faça upload da planilha"}
        {step === 2 && "Revise e selecione os passageiros para montar viagens"}
        {step === 3 && "Confirme as viagens sugeridas pela montagem inteligente"}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#1e3a5f]" />
              Upload de Planilha
            </CardTitle>
            <CardDescription>
              Faça upload de um arquivo CSV com os dados dos passageiros e viagens
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
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
            
            <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center bg-slate-50">
              <Upload className="w-12 h-12 mx-auto text-slate-400 mb-3" />
              <p className="text-sm text-slate-600 mb-2">
                Arraste o arquivo ou clique para selecionar
              </p>
              <p className="text-xs text-slate-400 mb-4">
                Formatos aceitos: CSV
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
                disabled={loading || !selectedCompanyId}
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
            
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700 font-medium mb-2">Colunas esperadas:</p>
              <p className="text-xs text-blue-600 font-mono">
                nome, telefone, endereco, bairro, cidade, hora, destino
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === 2 && preview && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#1e3a5f]" />
              Revisão dos Dados
            </CardTitle>
            <CardDescription>
              {preview.valid_rows} válidos de {preview.total_rows} registros
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge className="bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {preview.valid_rows} válidos
                </Badge>
                {preview.invalid_rows > 0 && (
                  <Badge className="bg-red-100 text-red-700">
                    <XCircle className="w-3 h-3 mr-1" />
                    {preview.invalid_rows} inválidos
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label>Data do Agendamento:</Label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>
            
            <div className="max-h-[400px] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input 
                        type="checkbox" 
                        checked={selectedRows.length === preview.rows.filter(r => r.is_valid).length}
                        onChange={toggleAllRows}
                        className="w-4 h-4"
                      />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Bairro</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row) => (
                    <TableRow 
                      key={row.row_num}
                      className={!row.is_valid ? 'bg-red-50' : selectedRows.includes(row.row_num) ? 'bg-blue-50' : ''}
                    >
                      <TableCell>
                        <input 
                          type="checkbox" 
                          checked={selectedRows.includes(row.row_num)}
                          onChange={() => toggleRow(row.row_num)}
                          disabled={!row.is_valid}
                          className="w-4 h-4"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{row.passenger_name || '-'}</TableCell>
                      <TableCell>{row.passenger_phone || '-'}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{row.passenger_address || '-'}</TableCell>
                      <TableCell>{row.passenger_neighborhood || '-'}</TableCell>
                      <TableCell>{row.passenger_city || '-'}</TableCell>
                      <TableCell>{row.pickup_time || '-'}</TableCell>
                      <TableCell className="max-w-[120px] truncate">{row.destination || '-'}</TableCell>
                      <TableCell>
                        {row.is_valid ? (
                          row.passenger_id ? (
                            <Badge className="bg-emerald-100 text-emerald-700">Existente</Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-700">Novo</Badge>
                          )
                        ) : (
                          <Badge className="bg-red-100 text-red-700">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Erro
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button 
                onClick={handleAssemble}
                disabled={loading || selectedRows.length === 0 || !scheduledDate}
                className="btn-navy"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Montando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Montar Viagens ({selectedRows.length} passageiros)
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Suggestions */}
      {step === 3 && suggestions && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#1e3a5f]" />
              Montagem Inteligente
            </CardTitle>
            <CardDescription>
              {suggestions.suggestions.length} viagens sugeridas • {suggestions.total_vehicles_needed} veículos necessários
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {suggestions.warnings.length > 0 && (
              <div className="p-3 bg-amber-50 rounded-lg">
                {suggestions.warnings.map((w, i) => (
                  <p key={i} className="text-sm text-amber-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {w}
                  </p>
                ))}
              </div>
            )}
            
            <div className="space-y-3">
              {suggestions.suggestions.map((suggestion) => {
                const VehicleIcon = VEHICLE_ICONS[suggestion.vehicle_type] || Car;
                return (
                  <div 
                    key={suggestion.id}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                      selectedSuggestions.includes(suggestion.id) 
                        ? 'border-[#1e3a5f] bg-[#1e3a5f]/5' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => toggleSuggestion(suggestion.id)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          selectedSuggestions.includes(suggestion.id) 
                            ? 'bg-[#1e3a5f] text-white' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          <VehicleIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">
                            {VEHICLE_LABELS[suggestion.vehicle_type]} • {suggestion.passenger_count} passageiros
                          </p>
                          <p className="text-sm text-slate-500">
                            Capacidade: {suggestion.vehicle_capacity} lugares
                          </p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={selectedSuggestions.includes(suggestion.id)}
                        onChange={() => {}}
                        className="w-5 h-5"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin className="w-4 h-4" />
                        <span>{suggestion.city || suggestion.neighborhood || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-4 h-4" />
                        <span>{suggestion.scheduled_time || 'A definir'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <ChevronRight className="w-4 h-4" />
                        <span>{suggestion.destination || 'Destino'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Users className="w-4 h-4" />
                        <span>{suggestion.driver_name || 'Sem motorista'}</span>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex flex-wrap gap-1">
                      {suggestion.passengers.slice(0, 5).map((p, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {p.name}
                        </Badge>
                      ))}
                      {suggestion.passengers.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{suggestion.passengers.length - 5} mais
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                Voltar
              </Button>
              <Button 
                onClick={handleConfirm}
                disabled={loading || selectedSuggestions.length === 0}
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
                    Confirmar {selectedSuggestions.length} Viagens
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
