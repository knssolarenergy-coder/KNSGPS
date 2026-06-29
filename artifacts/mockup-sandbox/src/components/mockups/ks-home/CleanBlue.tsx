import React from 'react';
import { 
  Sun, Zap, Droplets, Wrench, AlertCircle, 
  MessageCircle, Home, Activity, List, User, 
  ChevronRight, LogOut 
} from 'lucide-react';

export function CleanBlue() {
  return (
    <div style={{ width: 390, height: 844, overflowY: 'auto', fontFamily: 'Inter, sans-serif' }} className="bg-white relative flex flex-col shadow-xl border border-gray-100">
      
      {/* Header / Hero */}
      <div className="px-5 pt-12 pb-6 bg-white flex justify-between items-center border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <Sun size={24} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">Welcome back</p>
            <h1 className="text-lg font-semibold text-gray-900">Ahmed Khan</h1>
          </div>
        </div>
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
          <LogOut size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-24 space-y-8">
        
        {/* Stats Row */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">My Orders</h2>
            <button className="text-xs font-medium text-blue-600 flex items-center hover:underline">
              View all <ChevronRight size={14} className="ml-0.5" />
            </button>
          </div>
          
          <div className="flex gap-3">
            <div className="flex-1 bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <p className="text-xs text-gray-500 font-medium mb-1">Total</p>
              <p className="text-2xl font-bold text-gray-900">3</p>
            </div>
            <div className="flex-1 bg-orange-50 rounded-2xl p-4 border border-orange-100">
              <p className="text-xs text-orange-600/80 font-medium mb-1">Pending</p>
              <p className="text-2xl font-bold text-orange-600">1</p>
            </div>
            <div className="flex-1 bg-green-50 rounded-2xl p-4 border border-green-100">
              <p className="text-xs text-green-600/80 font-medium mb-1">Done</p>
              <p className="text-2xl font-bold text-green-600">2</p>
            </div>
          </div>
        </div>

        {/* Services Grid */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Services</h2>
          <div className="grid grid-cols-2 gap-3">
            
            <button className="bg-[#EFF6FF] rounded-2xl p-4 flex flex-col items-start text-left active:scale-[0.98] transition-transform">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mb-3 shadow-sm">
                <Activity size={20} className="text-[#2563EB]" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Inverter Status</h3>
              <p className="text-xs text-gray-500 mt-1">Check live metrics</p>
            </button>

            <button className="bg-[#EFF6FF] rounded-2xl p-4 flex flex-col items-start text-left active:scale-[0.98] transition-transform">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mb-3 shadow-sm">
                <Droplets size={20} className="text-[#2563EB]" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Panel Washing</h3>
              <p className="text-xs text-gray-500 mt-1">Book a wash</p>
            </button>

            <button className="bg-[#EFF6FF] rounded-2xl p-4 flex flex-col items-start text-left active:scale-[0.98] transition-transform">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mb-3 shadow-sm">
                <Wrench size={20} className="text-[#2563EB]" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Installation</h3>
              <p className="text-xs text-gray-500 mt-1">New setup</p>
            </button>

            <button className="bg-red-50 rounded-2xl p-4 flex flex-col items-start text-left active:scale-[0.98] transition-transform border border-red-100">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mb-3 shadow-sm">
                <AlertCircle size={20} className="text-red-500" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Complaint</h3>
              <p className="text-xs text-gray-500 mt-1">Report an issue</p>
            </button>

          </div>
        </div>

        {/* WhatsApp Support */}
        <button className="w-full bg-[#F0FDF4] rounded-2xl p-4 flex items-center justify-between active:scale-[0.98] transition-transform border border-[#DCFCE7]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#22C55E] flex items-center justify-center">
              <MessageCircle size={24} className="text-white" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-gray-900">WhatsApp Support</h3>
              <p className="text-xs text-gray-600 mt-0.5">We typically reply in 5 mins</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>
        
      </div>

      {/* Bottom Tab Bar */}
      <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 flex items-center justify-around pb-6 pt-3 px-2">
        <button className="flex flex-col items-center gap-1 min-w-[64px]">
          <Home size={22} className="text-[#2563EB]" />
          <span className="text-[10px] font-medium text-[#2563EB]">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 min-w-[64px]">
          <Activity size={22} className="text-gray-400" />
          <span className="text-[10px] font-medium text-gray-500">Inverter</span>
        </button>
        <button className="flex flex-col items-center gap-1 min-w-[64px]">
          <List size={22} className="text-gray-400" />
          <span className="text-[10px] font-medium text-gray-500">Orders</span>
        </button>
        <button className="flex flex-col items-center gap-1 min-w-[64px]">
          <User size={22} className="text-gray-400" />
          <span className="text-[10px] font-medium text-gray-500">Account</span>
        </button>
      </div>
      
    </div>
  );
}
