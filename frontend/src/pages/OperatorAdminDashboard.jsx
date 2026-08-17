import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Building2, Users, Car, Truck, Plus, Settings, LogOut, LayoutDashboard,
  Loader2, RefreshCw, Phone, Mail, MapPin, Edit2, Trash2, Search,
  Upload, Download, FileSpreadsheet, UserCog, Calendar, Clock, User,
  Key, Copy, RotateCcw, ShieldCheck, ShieldOff, Clipboard, Route,
  Receipt, History
} from "lucide-react";
import ManualTripAssembly from "@/components/ManualTripAssembly";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function OperatorAdminDashboard() {
  const navigate = useNavigate();
  const { user, logout, authAxios, isOperatorAdmin, token } = useAuth();
  
  const [activeTab, setActiveTab] = useState("companies");
  const [loading, setLoading] = useState(true);
  
  // Data
  const [companies, setCompanies] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  
  // Stats
  const [stats, setStats] = useState({ companies: 0, passengers: 0, drivers: 0, vehicles: 0, trips: 0 });
  
  // Modals
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showPassengerModal, setShowPassengerModal] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [showManualAssembly, setShowManualAssembly] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  
  // Voucher editing
  const [editingTrip, setEditingTrip] = useState(null);
  const [voucherNumber, setVoucherNumber] = useState("");
  const [voucherSaving, setVoucherSaving] = useState(false);
  
  // Credential management
  const [credentialCompany, setCredentialCompany] = useState(null);
  const [credentialEmail, setCredentialEmail] = useState("");
  const [generatedCredential, setGeneratedCredential] = useState(null);
  const [credentialLoading, setCredentialLoading] = useState(false);
  
  // Edit mode
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Upload
  const [uploadType, setUploadType] = useState("passengers");
  const [uploading, setUploading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const fileInputRef = useRef(null);
  
  // Search
  const [searchTerm, setSearchTerm] = useState("");

  // Form data
  const [companyForm, setCompanyForm] = useState({
    legal_name: "", trade_name: "", tax_id: "", phone: "", email: "",
    address: "", city: "", state: "", neighborhood: "", default_pickup_address: "", notes: ""
  });
  
  const [passengerForm, setPassengerForm] = useState({
    client_company_id: "", matricula: "", name: "", phone: "", email: "",
    address: "", neighborhood: "", city: "", pickup_point: "", notes: ""
  });
  
  const [driverForm, setDriverForm] = useState({
    name: "", phone: "", email: "", document: "", license_number: "",
    license_category: "", license_expiry: "", authorized_cities: "", notes: ""
  });
  
  const [vehicleForm, setVehicleForm] = useState({
    brand: "", model: "", plate: "", vehicle_type: "car", capacity: "",
    color: "", year: "", primary_driver_id: "", notes: ""
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [companiesRes, passengersRes, driversRes, vehiclesRes, tripsRes] = await Promise.all([
        axios.get(`${API}/companies`, { headers }),
        axios.get(`${API}/passengers`, { headers }),
        axios.get(`${API}/drivers?active_only=false`, { headers }),
        axios.get(`${API}/vehicles`, { headers }),
        axios.get(`${API}/trips`, { headers })
      ]);
      
      setCompanies(companiesRes.data);
      setPassengers(passengersRes.data);
      setDrivers(driversRes.data);
      setVehicles(vehiclesRes.data);
      setTrips(tripsRes.data);
      
      setStats({
        companies: companiesRes.data.length,
        passengers: passengersRes.data.length,
        drivers: driversRes.data.length,
        vehicles: vehiclesRes.data.length,
        trips: tripsRes.data.length
      });
      
      if (companiesRes.data.length > 0 && !selectedCompanyId) {
        setSelectedCompanyId(companiesRes.data[0].id);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [token, selectedCompanyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Company CRUD
  const handleSaveCompany = async () => {
    if (!companyForm.legal_name.trim()) {
      toast.error("Razão social é obrigatória");
      return;
    }
    
    setSaving(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const data = {
        ...companyForm,
        operator_id: user?.operator_id || "arc-transporte-001"
      };
      
      if (editingItem) {
        await axios.put(`${API}/companies/${editingItem.id}`, data, { headers });
        toast.success("Empresa atualizada!");
      } else {
        await axios.post(`${API}/companies`, data, { headers });
        toast.success("Empresa criada!");
      }
      
      setShowCompanyModal(false);
      resetCompanyForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao salvar empresa");
    } finally {
      setSaving(false);
    }
  };

  const resetCompanyForm = () => {
    setCompanyForm({
      legal_name: "", trade_name: "", tax_id: "", phone: "", email: "",
      address: "", city: "", state: "", neighborhood: "", default_pickup_address: "", notes: ""
    });
    setEditingItem(null);
  };

  const editCompany = (company) => {
    setCompanyForm({
      legal_name: company.legal_name || "",
      trade_name: company.trade_name || "",
      tax_id: company.tax_id || "",
      phone: company.phone || "",
      email: company.email || "",
      address: company.address || "",
      city: company.city || "",
      state: company.state || "",
      neighborhood: company.neighborhood || "",
      default_pickup_address: company.default_pickup_address || "",
      notes: company.notes || ""
    });
    setEditingItem(company);
    setShowCompanyModal(true);
  };

  // Client Company Credential Management
  const openCredentialModal = async (company) => {
    setCredentialCompany(company);
    setCredentialEmail("");
    setGeneratedCredential(null);
    setCredentialLoading(true);
    
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/companies/${company.id}/credential`, { headers });
      if (response.data.has_credential) {
        setGeneratedCredential({
          email: response.data.user.email,
          status: response.data.user.status,
          last_login: response.data.user.last_login,
          existing: true
        });
      }
    } catch (error) {
      console.error("Error fetching credential:", error);
    } finally {
      setCredentialLoading(false);
      setShowCredentialModal(true);
    }
  };

  const createCompanyCredential = async () => {
    if (!credentialEmail.trim()) {
      toast.error("Email é obrigatório");
      return;
    }
    
    setCredentialLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post(
        `${API}/companies/${credentialCompany.id}/create-credential`,
        { email: credentialEmail },
        { headers }
      );
      
      setGeneratedCredential({
        email: response.data.email,
        password: response.data.password,
        status: 'active',
        existing: false,
        justCreated: true
      });
      
      toast.success("Credencial criada com sucesso!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao criar credencial");
    } finally {
      setCredentialLoading(false);
    }
  };

  const resetCompanyPassword = async () => {
    setCredentialLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post(
        `${API}/companies/${credentialCompany.id}/reset-password`,
        {},
        { headers }
      );
      
      setGeneratedCredential({
        email: response.data.email,
        password: response.data.password,
        status: 'active',
        existing: true,
        justReset: true
      });
      
      toast.success("Senha redefinida com sucesso!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao redefinir senha");
    } finally {
      setCredentialLoading(false);
    }
  };

  const toggleCompanyAccess = async (active) => {
    setCredentialLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.put(
        `${API}/companies/${credentialCompany.id}/toggle-access`,
        { active },
        { headers }
      );
      
      setGeneratedCredential(prev => ({ ...prev, status: active ? 'active' : 'inactive' }));
      toast.success(`Acesso ${active ? 'ativado' : 'desativado'} com sucesso!`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao alterar acesso");
    } finally {
      setCredentialLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  // Voucher Management
  const openVoucherModal = (trip) => {
    setEditingTrip(trip);
    setVoucherNumber(trip.voucher_number || "");
    setShowVoucherModal(true);
  };

  const saveVoucher = async () => {
    if (!editingTrip) return;
    
    setVoucherSaving(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.put(
        `${API}/trips/${editingTrip.id}/voucher`,
        { voucher_number: voucherNumber },
        { headers }
      );
      
      // Update local state
      setTrips(prev => prev.map(t => 
        t.id === editingTrip.id ? { ...t, voucher_number: voucherNumber } : t
      ));
      
      toast.success("Voucher salvo com sucesso!");
      setShowVoucherModal(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao salvar voucher");
    } finally {
      setVoucherSaving(false);
    }
  };

  // Passenger CRUD
  const handleSavePassenger = async () => {
    if (!passengerForm.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!passengerForm.client_company_id) {
      toast.error("Selecione uma empresa");
      return;
    }
    
    setSaving(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      if (editingItem) {
        await axios.put(`${API}/passengers/${editingItem.id}`, passengerForm, { headers });
        toast.success("Passageiro atualizado!");
      } else {
        await axios.post(`${API}/passengers`, passengerForm, { headers });
        toast.success("Passageiro criado!");
      }
      
      setShowPassengerModal(false);
      resetPassengerForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao salvar passageiro");
    } finally {
      setSaving(false);
    }
  };

  const resetPassengerForm = () => {
    setPassengerForm({
      client_company_id: selectedCompanyId || "", matricula: "", name: "", phone: "", email: "",
      address: "", neighborhood: "", city: "", pickup_point: "", notes: ""
    });
    setEditingItem(null);
  };

  const editPassenger = (passenger) => {
    setPassengerForm({
      client_company_id: passenger.client_company_id || "",
      matricula: passenger.matricula || "",
      name: passenger.name || "",
      phone: passenger.phone || "",
      email: passenger.email || "",
      address: passenger.address || "",
      neighborhood: passenger.neighborhood || "",
      city: passenger.city || "",
      pickup_point: passenger.pickup_point || "",
      notes: passenger.notes || ""
    });
    setEditingItem(passenger);
    setShowPassengerModal(true);
  };

  // Driver CRUD
  const handleSaveDriver = async () => {
    if (!driverForm.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    
    setSaving(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const data = {
        ...driverForm,
        authorized_cities: driverForm.authorized_cities ? driverForm.authorized_cities.split(",").map(c => c.trim()) : []
      };
      
      if (editingItem) {
        await axios.put(`${API}/drivers/${editingItem.id}`, data, { headers });
        toast.success("Motorista atualizado!");
      } else {
        await axios.post(`${API}/drivers`, data, { headers });
        toast.success("Motorista criado!");
      }
      
      setShowDriverModal(false);
      resetDriverForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao salvar motorista");
    } finally {
      setSaving(false);
    }
  };

  const resetDriverForm = () => {
    setDriverForm({
      name: "", phone: "", email: "", document: "", license_number: "",
      license_category: "", license_expiry: "", authorized_cities: "", notes: ""
    });
    setEditingItem(null);
  };

  const editDriver = (driver) => {
    setDriverForm({
      name: driver.name || "",
      phone: driver.phone || "",
      email: driver.email || "",
      document: driver.document || "",
      license_number: driver.license_number || "",
      license_category: driver.license_category || "",
      license_expiry: driver.license_expiry || "",
      authorized_cities: (driver.authorized_cities || []).join(", "),
      notes: driver.notes || ""
    });
    setEditingItem(driver);
    setShowDriverModal(true);
  };

  // Vehicle CRUD
  const handleSaveVehicle = async () => {
    if (!vehicleForm.plate.trim()) {
      toast.error("Placa é obrigatória");
      return;
    }
    
    setSaving(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const data = {
        ...vehicleForm,
        capacity: vehicleForm.capacity ? parseInt(vehicleForm.capacity) : null
      };
      
      if (editingItem) {
        await axios.put(`${API}/vehicles/${editingItem.id}`, data, { headers });
        toast.success("Veículo atualizado!");
      } else {
        await axios.post(`${API}/vehicles`, data, { headers });
        toast.success("Veículo criado!");
      }
      
      setShowVehicleModal(false);
      resetVehicleForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao salvar veículo");
    } finally {
      setSaving(false);
    }
  };

  const resetVehicleForm = () => {
    setVehicleForm({
      brand: "", model: "", plate: "", vehicle_type: "car", capacity: "",
      color: "", year: "", primary_driver_id: "", notes: ""
    });
    setEditingItem(null);
  };

  const editVehicle = (vehicle) => {
    setVehicleForm({
      brand: vehicle.brand || "",
      model: vehicle.model || "",
      plate: vehicle.plate || "",
      vehicle_type: vehicle.vehicle_type || "car",
      capacity: vehicle.capacity?.toString() || "",
      color: vehicle.color || "",
      year: vehicle.year || "",
      primary_driver_id: vehicle.primary_driver_id || "",
      notes: vehicle.notes || ""
    });
    setEditingItem(vehicle);
    setShowVehicleModal(true);
  };

  // CSV Upload
  const handleCSVUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!selectedCompanyId && uploadType === "passengers") {
      toast.error("Selecione uma empresa primeiro");
      return;
    }
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let url = "";
      
      if (uploadType === "passengers") {
        url = `${API}/passengers/upload-csv?client_company_id=${selectedCompanyId}`;
      } else if (uploadType === "drivers") {
        url = `${API}/drivers/upload-csv`;
      }
      
      const response = await axios.post(url, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(response.data.message);
      setShowUploadModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao importar CSV");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Filter data
  const filteredPassengers = passengers.filter(p => 
    (selectedCompanyId === "all" || !selectedCompanyId || p.client_company_id === selectedCompanyId) &&
    (!searchTerm || 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.matricula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone?.includes(searchTerm)
    )
  );

  const filteredDrivers = drivers.filter(d =>
    !searchTerm ||
    d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.phone?.includes(searchTerm)
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getCompanyName = (id) => {
    const company = companies.find(c => c.id === id);
    return company?.trade_name || company?.legal_name || "N/A";
  };

  const getDriverName = (id) => {
    const driver = drivers.find(d => d.id === id);
    return driver?.name || "N/A";
  };

  if (loading && companies.length === 0) {
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
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg font-['Manrope']">Gestão de Operador</h1>
              <p className="text-xs text-white/70">{user?.operator_name || "ARC Transporte"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-white/20 text-white border-0">
              <User className="w-3 h-3 mr-1" />
              {user?.name || "Admin"}
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
              onClick={() => navigate('/admin-control')}
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              Painel Legado
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

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Empresas</p>
                  <p className="text-2xl font-bold text-[#1e3a5f]">{stats.companies}</p>
                </div>
                <Building2 className="w-8 h-8 text-blue-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Passageiros</p>
                  <p className="text-2xl font-bold text-[#1e3a5f]">{stats.passengers}</p>
                </div>
                <Users className="w-8 h-8 text-emerald-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Motoristas</p>
                  <p className="text-2xl font-bold text-[#1e3a5f]">{stats.drivers}</p>
                </div>
                <UserCog className="w-8 h-8 text-amber-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Veículos</p>
                  <p className="text-2xl font-bold text-[#1e3a5f]">{stats.vehicles}</p>
                </div>
                <Truck className="w-8 h-8 text-purple-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Viagens</p>
                  <p className="text-2xl font-bold text-[#1e3a5f]">{stats.trips}</p>
                </div>
                <Car className="w-8 h-8 text-red-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="companies">Empresas</TabsTrigger>
              <TabsTrigger value="passengers">Passageiros</TabsTrigger>
              <TabsTrigger value="drivers">Motoristas</TabsTrigger>
              <TabsTrigger value="vehicles">Veículos</TabsTrigger>
              <TabsTrigger value="trips">Viagens</TabsTrigger>
              <TabsTrigger value="assembly">Montagem Manual</TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowUploadModal(true)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar CSV
              </Button>
            </div>
          </div>

          {/* Companies Tab */}
          <TabsContent value="companies">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Empresas Cliente</CardTitle>
                  <CardDescription>Gerencie as empresas que utilizam o serviço</CardDescription>
                </div>
                <Button onClick={() => { resetCompanyForm(); setShowCompanyModal(true); }} className="btn-navy">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Empresa
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Razão Social</TableHead>
                      <TableHead>Nome Fantasia</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">{company.legal_name}</TableCell>
                        <TableCell>{company.trade_name || "-"}</TableCell>
                        <TableCell>{company.tax_id || "-"}</TableCell>
                        <TableCell>{company.phone || "-"}</TableCell>
                        <TableCell>{company.city || "-"}</TableCell>
                        <TableCell>
                          <Badge className={company.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                            {company.status === 'active' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openCredentialModal(company)} title="Gerenciar Acesso">
                            <Key className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => editCompany(company)} title="Editar">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {companies.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                          Nenhuma empresa cadastrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Passengers Tab */}
          <TabsContent value="passengers">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Passageiros</CardTitle>
                  <CardDescription>Base de dados de funcionários/passageiros</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filtrar por empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.trade_name || c.legal_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => { resetPassengerForm(); setShowPassengerModal(true); }} className="btn-navy">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Passageiro
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPassengers.map((passenger) => (
                      <TableRow key={passenger.id}>
                        <TableCell className="font-mono">{passenger.matricula || "-"}</TableCell>
                        <TableCell className="font-medium">{passenger.name}</TableCell>
                        <TableCell>{passenger.phone || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{passenger.address || "-"}</TableCell>
                        <TableCell>{getCompanyName(passenger.client_company_id)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => editPassenger(passenger)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredPassengers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                          Nenhum passageiro encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Drivers Tab */}
          <TabsContent value="drivers">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Motoristas</CardTitle>
                  <CardDescription>Gerencie a equipe de motoristas</CardDescription>
                </div>
                <Button onClick={() => { resetDriverForm(); setShowDriverModal(true); }} className="btn-navy">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Motorista
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>CNH</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Cidades</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDrivers.map((driver) => (
                      <TableRow key={driver.id}>
                        <TableCell className="font-medium">{driver.name}</TableCell>
                        <TableCell>{driver.phone || "-"}</TableCell>
                        <TableCell>{driver.license_number || "-"}</TableCell>
                        <TableCell>{driver.license_category || "-"}</TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {(driver.authorized_cities || []).join(", ") || "Todas"}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            driver.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                            driver.status === 'on_trip' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                          }>
                            {driver.status === 'available' ? 'Disponível' :
                             driver.status === 'on_trip' ? 'Em viagem' :
                             driver.status === 'vacation' ? 'Férias' :
                             driver.status === 'day_off' ? 'Folga' : 'Indisponível'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => editDriver(driver)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredDrivers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                          Nenhum motorista cadastrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vehicles Tab */}
          <TabsContent value="vehicles">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Veículos</CardTitle>
                  <CardDescription>Gerencie a frota de veículos</CardDescription>
                </div>
                <Button onClick={() => { resetVehicleForm(); setShowVehicleModal(true); }} className="btn-navy">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Veículo
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placa</TableHead>
                      <TableHead>Marca/Modelo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Capacidade</TableHead>
                      <TableHead>Motorista Principal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((vehicle) => (
                      <TableRow key={vehicle.id}>
                        <TableCell className="font-mono font-medium">{vehicle.plate}</TableCell>
                        <TableCell>{`${vehicle.brand || ""} ${vehicle.model || ""}`.trim() || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {vehicle.vehicle_type === 'car' ? 'Carro' :
                             vehicle.vehicle_type === 'van' ? 'Van' :
                             vehicle.vehicle_type === 'bus' ? 'Ônibus' :
                             vehicle.vehicle_type === 'taxi' ? 'Táxi' : vehicle.vehicle_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{vehicle.capacity} lugares</TableCell>
                        <TableCell>{getDriverName(vehicle.primary_driver_id)}</TableCell>
                        <TableCell>
                          <Badge className={
                            vehicle.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                            vehicle.status === 'on_trip' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                          }>
                            {vehicle.status === 'available' ? 'Disponível' :
                             vehicle.status === 'on_trip' ? 'Em uso' :
                             vehicle.status === 'maintenance' ? 'Manutenção' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => editVehicle(vehicle)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {vehicles.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                          Nenhum veículo cadastrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trips/History Tab */}
          <TabsContent value="trips">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5 text-[#1e3a5f]" />
                    Histórico de Viagens
                  </CardTitle>
                  <CardDescription>Visualize e gerencie todas as viagens realizadas</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Solicitante</TableHead>
                      <TableHead>Passageiros</TableHead>
                      <TableHead>Motorista</TableHead>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Voucher</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trips.filter(t => {
                      if (!searchTerm) return true;
                      const search = searchTerm.toLowerCase();
                      return (
                        t.requester_name?.toLowerCase().includes(search) ||
                        t.driver_name?.toLowerCase().includes(search) ||
                        t.voucher_number?.toLowerCase().includes(search) ||
                        t.passengers?.some(p => p.name?.toLowerCase().includes(search))
                      );
                    }).map((trip) => {
                      const company = companies.find(c => c.id === trip.client_company_id);
                      const mainPassenger = trip.passengers?.[0];
                      return (
                        <TableRow key={trip.id}>
                          <TableCell className="whitespace-nowrap">
                            {trip.created_at?.split('T')[0]}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate">
                            {company?.trade_name || company?.legal_name || '-'}
                          </TableCell>
                          <TableCell>{trip.requester_name || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-400" />
                              <span>{trip.passenger_count || trip.passengers?.length || 0}</span>
                              {mainPassenger && (
                                <span className="text-xs text-slate-500 truncate max-w-[80px]" title={mainPassenger.name}>
                                  ({mainPassenger.name})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{trip.driver_name || '-'}</TableCell>
                          <TableCell>
                            {trip.vehicle_plate ? (
                              <Badge variant="outline" className="text-xs">
                                {trip.vehicle_plate}
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {trip.voucher_number ? (
                              <Badge variant="secondary" className="font-mono text-xs">
                                <Receipt className="w-3 h-3 mr-1" />
                                {trip.voucher_number}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              trip.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              trip.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                              trip.status === 'in_progress' ? 'bg-purple-100 text-purple-700' :
                              trip.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                              'bg-amber-100 text-amber-700'
                            }>
                              {trip.status === 'pending' ? 'Aguardando' :
                               trip.status === 'scheduled' ? 'Agendado' :
                               trip.status === 'confirmed' ? 'Confirmado' :
                               trip.status === 'in_progress' ? 'Em Andamento' :
                               trip.status === 'completed' ? 'Finalizado' :
                               trip.status === 'cancelled' ? 'Cancelado' : trip.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openVoucherModal(trip)}
                              title="Editar Voucher"
                            >
                              <Receipt className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Manual Assembly Tab */}
          <TabsContent value="assembly">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Route className="w-5 h-5 text-[#1e3a5f]" />
                  Montagem Manual de Viagens
                </CardTitle>
                <CardDescription>
                  Importe uma planilha e monte viagens manualmente, atribuindo passageiros a veículos específicos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ManualTripAssembly 
                  companies={companies}
                  drivers={drivers}
                  vehicles={vehicles}
                  onComplete={() => {
                    setActiveTab("companies");
                    fetchData();
                    toast.success("Viagens criadas com sucesso!");
                  }}
                  onClose={() => setActiveTab("companies")}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Company Modal */}
      <Dialog open={showCompanyModal} onOpenChange={setShowCompanyModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Razão Social *</Label>
                <Input value={companyForm.legal_name} onChange={(e) => setCompanyForm({...companyForm, legal_name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Nome Fantasia</Label>
                <Input value={companyForm.trade_name} onChange={(e) => setCompanyForm({...companyForm, trade_name: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={companyForm.tax_id} onChange={(e) => setCompanyForm({...companyForm, tax_id: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={companyForm.phone} onChange={(e) => setCompanyForm({...companyForm, phone: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={companyForm.email} onChange={(e) => setCompanyForm({...companyForm, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={companyForm.address} onChange={(e) => setCompanyForm({...companyForm, address: e.target.value})} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={companyForm.city} onChange={(e) => setCompanyForm({...companyForm, city: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input value={companyForm.neighborhood} onChange={(e) => setCompanyForm({...companyForm, neighborhood: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input value={companyForm.state} onChange={(e) => setCompanyForm({...companyForm, state: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Endereço Padrão de Coleta</Label>
              <Input value={companyForm.default_pickup_address} onChange={(e) => setCompanyForm({...companyForm, default_pickup_address: e.target.value})} placeholder="Ex: FIXAR" />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={companyForm.notes} onChange={(e) => setCompanyForm({...companyForm, notes: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompanyModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveCompany} disabled={saving} className="btn-navy">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingItem ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Passenger Modal */}
      <Dialog open={showPassengerModal} onOpenChange={setShowPassengerModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Passageiro' : 'Novo Passageiro'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <Select value={passengerForm.client_company_id} onValueChange={(v) => setPassengerForm({...passengerForm, client_company_id: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.trade_name || c.legal_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Matrícula</Label>
                <Input value={passengerForm.matricula} onChange={(e) => setPassengerForm({...passengerForm, matricula: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={passengerForm.name} onChange={(e) => setPassengerForm({...passengerForm, name: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={passengerForm.phone} onChange={(e) => setPassengerForm({...passengerForm, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={passengerForm.email} onChange={(e) => setPassengerForm({...passengerForm, email: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={passengerForm.address} onChange={(e) => setPassengerForm({...passengerForm, address: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input value={passengerForm.neighborhood} onChange={(e) => setPassengerForm({...passengerForm, neighborhood: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={passengerForm.city} onChange={(e) => setPassengerForm({...passengerForm, city: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ponto de Coleta</Label>
              <Input value={passengerForm.pickup_point} onChange={(e) => setPassengerForm({...passengerForm, pickup_point: e.target.value})} placeholder="Ex: Portaria principal" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPassengerModal(false)}>Cancelar</Button>
            <Button onClick={handleSavePassenger} disabled={saving} className="btn-navy">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingItem ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Driver Modal */}
      <Dialog open={showDriverModal} onOpenChange={setShowDriverModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Motorista' : 'Novo Motorista'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={driverForm.name} onChange={(e) => setDriverForm({...driverForm, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={driverForm.phone} onChange={(e) => setDriverForm({...driverForm, phone: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={driverForm.email} onChange={(e) => setDriverForm({...driverForm, email: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={driverForm.document} onChange={(e) => setDriverForm({...driverForm, document: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>CNH</Label>
                <Input value={driverForm.license_number} onChange={(e) => setDriverForm({...driverForm, license_number: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria CNH</Label>
                <Select value={driverForm.license_category} onValueChange={(v) => setDriverForm({...driverForm, license_category: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                    <SelectItem value="D">D</SelectItem>
                    <SelectItem value="E">E</SelectItem>
                    <SelectItem value="AB">AB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Validade CNH</Label>
                <Input type="date" value={driverForm.license_expiry} onChange={(e) => setDriverForm({...driverForm, license_expiry: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cidades Autorizadas (separar por vírgula)</Label>
              <Input value={driverForm.authorized_cities} onChange={(e) => setDriverForm({...driverForm, authorized_cities: e.target.value})} placeholder="Ex: São Paulo, Guarulhos, Campinas" />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={driverForm.notes} onChange={(e) => setDriverForm({...driverForm, notes: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDriverModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveDriver} disabled={saving} className="btn-navy">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingItem ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle Modal */}
      <Dialog open={showVehicleModal} onOpenChange={setShowVehicleModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Veículo' : 'Novo Veículo'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Placa *</Label>
                <Input value={vehicleForm.plate} onChange={(e) => setVehicleForm({...vehicleForm, plate: e.target.value.toUpperCase()})} placeholder="ABC-1234" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={vehicleForm.vehicle_type} onValueChange={(v) => setVehicleForm({...vehicleForm, vehicle_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="car">Carro</SelectItem>
                    <SelectItem value="taxi">Táxi</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="minibus">Micro-ônibus</SelectItem>
                    <SelectItem value="bus">Ônibus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input value={vehicleForm.brand} onChange={(e) => setVehicleForm({...vehicleForm, brand: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Input value={vehicleForm.model} onChange={(e) => setVehicleForm({...vehicleForm, model: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Ano</Label>
                <Input value={vehicleForm.year} onChange={(e) => setVehicleForm({...vehicleForm, year: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <Input value={vehicleForm.color} onChange={(e) => setVehicleForm({...vehicleForm, color: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Capacidade</Label>
                <Input type="number" value={vehicleForm.capacity} onChange={(e) => setVehicleForm({...vehicleForm, capacity: e.target.value})} placeholder="Auto" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Motorista Principal</Label>
              <Select value={vehicleForm.primary_driver_id || "none"} onValueChange={(v) => setVehicleForm({...vehicleForm, primary_driver_id: v === "none" ? "" : v})}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={vehicleForm.notes} onChange={(e) => setVehicleForm({...vehicleForm, notes: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVehicleModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveVehicle} disabled={saving} className="btn-navy">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingItem ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Importar CSV
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Importação</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="passengers">Passageiros</SelectItem>
                  <SelectItem value="drivers">Motoristas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {uploadType === "passengers" && (
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.trade_name || c.legal_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-2">
                <strong>Colunas esperadas:</strong>
              </p>
              <p className="text-xs text-slate-500 font-mono">
                {uploadType === "passengers" 
                  ? "matricula, name, phone, address, neighborhood, city" 
                  : "name, phone"}
              </p>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              accept=".csv" 
              onChange={handleCSVUpload} 
              className="hidden" 
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadModal(false)}>Cancelar</Button>
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={uploading || (uploadType === "passengers" && !selectedCompanyId)} 
              className="btn-navy"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Selecionar Arquivo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credential Management Modal */}
      <Dialog open={showCredentialModal} onOpenChange={setShowCredentialModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-[#1e3a5f]" />
              Gerenciar Acesso da Empresa
            </DialogTitle>
            <DialogDescription>
              {credentialCompany?.trade_name || credentialCompany?.legal_name}
            </DialogDescription>
          </DialogHeader>
          
          {credentialLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#1e3a5f]" />
              <p className="text-sm text-slate-500 mt-2">Carregando...</p>
            </div>
          ) : generatedCredential?.existing || generatedCredential?.justCreated ? (
            <div className="space-y-4 py-4">
              {/* Existing or Just Created Credential */}
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Email</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generatedCredential.email)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm font-mono bg-white p-2 rounded border">
                  {generatedCredential.email}
                </p>
              </div>
              
              {(generatedCredential.password || generatedCredential.justCreated || generatedCredential.justReset) && (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-amber-800">Senha</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(generatedCredential.password)}
                    >
                      <Copy className="w-4 h-4 text-amber-700" />
                    </Button>
                  </div>
                  <p className="text-sm font-mono bg-white p-2 rounded border border-amber-200">
                    {generatedCredential.password}
                  </p>
                  <p className="text-xs text-amber-700 mt-2">
                    ⚠️ Copie e envie esta senha ao cliente. Ela não será mostrada novamente!
                  </p>
                </div>
              )}
              
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  {generatedCredential.status === 'active' ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <ShieldOff className="w-4 h-4 text-red-600" />
                  )}
                  <span className="text-sm">
                    Acesso {generatedCredential.status === 'active' ? 'Ativo' : 'Desativado'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleCompanyAccess(generatedCredential.status !== 'active')}
                  disabled={credentialLoading}
                >
                  {generatedCredential.status === 'active' ? 'Desativar' : 'Ativar'}
                </Button>
              </div>
              
              {generatedCredential.last_login && (
                <p className="text-xs text-slate-500">
                  Último login: {new Date(generatedCredential.last_login).toLocaleString('pt-BR')}
                </p>
              )}
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={resetCompanyPassword}
                  disabled={credentialLoading}
                  className="flex-1"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Redefinir Senha
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* No Credential Yet */}
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <Key className="w-8 h-8 mx-auto text-blue-500 mb-2" />
                <p className="text-sm text-blue-700">
                  Esta empresa ainda não possui credenciais de acesso.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Email para Login *</Label>
                <Input
                  type="email"
                  placeholder="empresa@email.com"
                  value={credentialEmail}
                  onChange={(e) => setCredentialEmail(e.target.value)}
                />
              </div>
              
              <Button
                onClick={createCompanyCredential}
                disabled={credentialLoading || !credentialEmail.trim()}
                className="w-full btn-navy"
              >
                {credentialLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    Criar Credencial
                  </>
                )}
              </Button>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCredentialModal(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voucher Edit Modal */}
      <Dialog open={showVoucherModal} onOpenChange={setShowVoucherModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#1e3a5f]" />
              Editar Voucher
            </DialogTitle>
            <DialogDescription>
              {editingTrip && (
                <>
                  Viagem de {editingTrip.requester_name || editingTrip.passengers?.[0]?.name || 'N/A'} 
                  {' - '}{editingTrip.created_at?.split('T')[0]}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Número do Voucher</Label>
              <Input
                placeholder="Ex: VCH-2024-001"
                value={voucherNumber}
                onChange={(e) => setVoucherNumber(e.target.value)}
                data-testid="voucher-input"
              />
              <p className="text-xs text-slate-500">
                Campo opcional. Pode ser preenchido ou alterado a qualquer momento, inclusive após a conclusão da viagem.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVoucherModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={saveVoucher}
              disabled={voucherSaving}
              className="btn-navy"
            >
              {voucherSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Receipt className="w-4 h-4 mr-2" />
                  Salvar Voucher
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
