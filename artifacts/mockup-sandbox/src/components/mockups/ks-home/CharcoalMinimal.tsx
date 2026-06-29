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
  LogOut,
} from 'lucide-react';

export function CharcoalMinimal() {
  return (
    <div
      style={{
        width: 390,
        height: 844,
        overflowY: 'auto',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: '#FAFAF9',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header / Hero */}
      <div
        className="px-4 pt-12 pb-16 rounded-b-3xl"
        style={{ backgroundColor: '#1C1917', color: '#FAFAF9' }}
      >
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10">
              <Sun className="w-6 h-6 text-[#FAFAF9]" />
            </div>
            <div>
              <p className="text-xs text-stone-400 font-medium">Welcome back,</p>
              <p className="text-lg font-semibold tracking-tight">Ahmed Khan</p>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <LogOut className="w-5 h-5 text-stone-300" />
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 -mt-10 pb-24 flex flex-col gap-5">
        {/* Stats Row */}
        <div className="flex gap-3">
          {[
            { label: 'Total Orders', value: '3', color: 'text-stone-900' },
            { label: 'Pending', value: '1', color: 'text-amber-600' },
            { label: 'Completed', value: '2', color: 'text-[#059669]' },
          ].map((stat, i) => (
            <div
              key={i}
              className="flex-1 bg-white p-3 rounded-2xl flex flex-col justify-center items-center gap-1 shadow-sm"
              style={{ border: '1px solid #E7E5E4' }}
            >
              <span className={`text-2xl font-bold tracking-tight ${stat.color}`}>
                {stat.value}
              </span>
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider text-center">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* Services Grid */}
        <div>
          <h2 className="text-sm font-semibold text-stone-900 mb-3 ml-1">Services</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { title: 'Inverter Status', icon: Activity, desc: 'Real-time monitoring' },
              { title: 'Panel Washing', icon: Droplets, desc: 'Schedule maintenance' },
              { title: 'New Installation', icon: Wrench, desc: 'Request a quote' },
              { title: 'Submit Complaint', icon: AlertCircle, desc: 'Get support quickly' },
            ].map((service, i) => (
              <div
                key={i}
                className="bg-white p-4 rounded-2xl flex flex-col gap-3 shadow-sm active:scale-95 transition-transform"
                style={{ border: '1px solid #E7E5E4' }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#F0FDF4' }}
                >
                  <service.icon className="w-5 h-5 text-[#059669]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-stone-900">{service.title}</h3>
                  <p className="text-[11px] text-stone-500 mt-0.5">{service.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WhatsApp Support */}
        <div
          className="p-4 rounded-2xl flex items-center justify-between shadow-sm mt-2"
          style={{
            backgroundColor: '#059669',
            color: 'white',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Need help?</h3>
              <p className="text-xs text-white/80 mt-0.5">Chat with us on WhatsApp</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/60" />
        </div>
      </div>

      {/* Bottom Tab Bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-20 bg-[#FAFAF9] flex justify-between items-center px-6 pb-4 pt-2"
        style={{ borderTop: '1px solid #E7E5E4' }}
      >
        {[
          { icon: Home, label: 'Home', active: true },
          { icon: Zap, label: 'Inverter', active: false },
          { icon: List, label: 'My Orders', active: false },
          { icon: User, label: 'Account', active: false },
        ].map((tab, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 min-w-[64px]">
            <tab.icon
              className={`w-6 h-6 ${tab.active ? 'text-[#1C1917]' : 'text-stone-400'}`}
              strokeWidth={tab.active ? 2.5 : 2}
            />
            <span
              className={`text-[10px] font-medium ${
                tab.active ? 'text-[#1C1917]' : 'text-stone-400'
              }`}
            >
              {tab.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
