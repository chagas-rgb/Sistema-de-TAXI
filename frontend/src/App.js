import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import PassengerPortal from "@/pages/PassengerPortal";
import RequestStatus from "@/pages/RequestStatus";
import AdminDashboard from "@/pages/AdminDashboard";

function App() {
  return (
    <div className="App min-h-screen bg-slate-50">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PassengerPortal />} />
          <Route path="/status/:requestId" element={<RequestStatus />} />
          <Route path="/admin-control" element={<AdminDashboard />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
