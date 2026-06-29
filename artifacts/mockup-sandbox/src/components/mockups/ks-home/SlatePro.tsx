import React from 'react';
import { 
  Sun, 
  Zap, 
  Droplets, 
  Wrench, 
  AlertCircle, 
  MessageCircle, 
  Home, 
  Activity, 
  List, 
  User, 
  ChevronRight, 
  LogOut 
} from 'lucide-react';

export function SlatePro() {
  return (
    <div 
      className="relative bg-[#F8FAFC] text-slate-900"
      style={{ width: 390, height: 844, overflowY: 'auto', fontFamily: 'Inter, sans-serif' }}
    >
      {/* Header / Hero */}
      <div className="bg-[#0F172A] pt-12 pb-24 px-4 rounded-b-[32px] relative z-0">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#F59E0B] flex items-center justify-center">
              <Sun className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">K&S Solar</span>
          </div>
          <button className="text-slate-400 hover:text-white transition-colors p-2">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        
        <div>
          <p className="text-slate-400 text-sm mb-1">Good morning,</p>
          <h1 className="text-white text-2xl font-semibold">Ahmed Khan</h1>
        </div>
      </div>

      {/* Content Area */}
      <div className="px-4 -mt-14 relative z-10 pb-28">
        
        {/* Stats Row */}
        <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.05)] border border-slate-100 flex justify-between items-center mb-6">
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold text-[#0F172A]">3</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Total Orders</div>
          </div>
          <div className="w-px h-10 bg-slate-100"></div>
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold text-[#F59E0B]">1</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Pending</div>
          </div>
          <div className="w-px h-10 bg-slate-100"></div>
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold text-emerald-600">2</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Completed</div>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-3 px-1">Services</h2>
        
        {/* Service Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button className="bg-white p-4 rounded-2xl shadow-[0_2px_10px_-2px_rgba(15,23,42,0.03)] border border-slate-100 flex flex-col items-center justify-center text-center gap-3 active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">Inverter Status</span>
          </button>
          
          <button className="bg-white p-4 rounded-2xl shadow-[0_2px_10px_-2px_rgba(15,23,42,0.03)] border border-slate-100 flex flex-col items-center justify-center text-center gap-3 active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-cyan-50 flex items-center justify-center">
              <Droplets className="w-6 h-6 text-cyan-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">Panel Washing</span>
          </button>
          
          <button className="bg-white p-4 rounded-2xl shadow-[0_2px_10px_-2px_rgba(15,23,42,0.03)] border border-slate-100 flex flex-col items-center justify-center text-center gap-3 active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
              <Wrench className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">Installation</span>
          </button>
          
          <button className="bg-white p-4 rounded-2xl shadow-[0_2px_10px_-2px_rgba(15,23,42,0.03)] border border-slate-100 flex flex-col items-center justify-center text-center gap-3 active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-rose-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">Complaint</span>
          </button>
        </div>

        {/* WhatsApp Support */}
        <button className="w-full bg-[#128C7E] rounded-2xl p-4 flex items-center justify-between shadow-[0_4px_14px_-4px_rgba(18,140,126,0.4)] active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <div className="text-white font-medium">WhatsApp Support</div>
              <div className="text-white/80 text-xs mt-0.5">We typically reply in minutes</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/80" />
        </button>

      </div>

      {/* Bottom Tab Bar */}
      <div className="absolute bottom-0 w-full bg-white border-t border-slate-100 px-6 py-4 flex justify-between items-center rounded-t-[24px] shadow-[0_-4px_20px_-4px_rgba(15,23,42,0.05)] pb-8">
        <button className="flex flex-col items-center gap-1">
          <Home className="w-6 h-6 text-[#0F172A]" />
          <span className="text-[10px] font-medium text-[#0F172A]">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
          <Activity className="w-6 h-6 text-slate-600" />
          <span className="text-[10px] font-medium text-slate-600">Inverter</span>
        </button>
        <button className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
          <List className="w-6 h-6 text-slate-600" />
          <span className="text-[10px] font-medium text-slate-600">Orders</span>
        </button>
        <button className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
          <User className="w-6 h-6 text-slate-600" />
          <span className="text-[10px] font-medium text-slate-600">Account</span>
        </button>
      </div>

    </div>
  );
}
