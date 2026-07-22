"use client";

import { useEffect, useState, useRef } from "react";

interface Zone {
  zone_id: string;
  name: string;
  permit_type: string;
  gas_ppm: number;
  temperature: number;
  risk_score: number;
  risk_level: string;
  citation: string;
  recommendations: string[];
}

interface AgentLog {
  id: string;
  timestamp: string;
  zone: string;
  risk_level: string;
  message: string;
  citation: string;
  recommendations: string[];
}

export default function SafeSphereDashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [hazardInjected, setHazardInjected] = useState(false);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  // Sync hazard state on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("http://localhost:8000/status");
        if (res.ok) {
          const data = await res.json();
          setHazardInjected(data.hazard_injected);
        }
      } catch (err) {
        console.error("Failed to fetch initial status", err);
      }
    };
    fetchStatus();
  }, []);

  // Connect to WebSocket telemetry
  useEffect(() => {
    function connect() {
      const wsUrl = "ws://localhost:8000/ws/telemetry";
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setZones(data.zones);
          setHazardInjected(data.hazard_injected);

          // Update Agent Intelligence Feed on high/critical risk
          data.zones.forEach((zone: Zone) => {
            if (zone.risk_level === "CRITICAL" || zone.risk_level === "HIGH") {
              const now = new Date();
              const timestamp = now.toTimeString().split(" ")[0];
              const logId = `${zone.zone_id}-${now.getTime()}`;

              setAgentLogs((prev) => {
                // Avoid logging duplicates if the last log is same level/zone within 4 seconds
                if (prev.length > 0) {
                  const lastLog = prev[0];
                  const lastTime = parseInt(lastLog.id.split("-")[1] || "0");
                  if (
                    lastLog.zone === zone.name &&
                    lastLog.risk_level === zone.risk_level &&
                    now.getTime() - lastTime < 4000
                  ) {
                    return prev;
                  }
                }
                const newLog: AgentLog = {
                  id: logId,
                  timestamp,
                  zone: zone.name,
                  risk_level: zone.risk_level,
                  message: `AI Evaluation: High gas readings (${zone.gas_ppm} PPM) detected under '${zone.permit_type}' activity.`,
                  citation: zone.citation,
                  recommendations: zone.recommendations,
                };
                return [newLog, ...prev.slice(0, 19)];
              });
            }
          });
        } catch (e) {
          console.error("Error parsing telemetry stream data:", e);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  // API Call to toggle hazard
  const toggleHazard = async () => {
    try {
      const response = await fetch("http://localhost:8000/trigger-hazard");
      const data = await response.json();
      setHazardInjected(data.hazard_injected);
    } catch (e) {
      console.error("Error triggering gas hazard injection:", e);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Dynamic Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-slate-200">SAFESPHERE AI</h1>
            <p className="text-xs text-slate-400">Industrial Safety Intelligence & Compliance Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? "bg-emerald-400" : "bg-rose-500"}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? "bg-emerald-500" : "bg-rose-500"}`}></span>
            </span>
            <span className="text-xs font-semibold tracking-wide text-slate-300">
              {isConnected ? "TELEMETRY CONNECTED" : "TELEMETRY OFFLINE"}
            </span>
          </div>

          {/* Trigger Hazard Button */}
          <button
            id="inject-hazard-btn"
            onClick={toggleHazard}
            className={`cursor-pointer px-4 py-2 rounded-lg font-bold text-xs tracking-wider transition-all duration-300 shadow-md ${
              hazardInjected
                ? "bg-rose-600 text-white hover:bg-rose-700 animate-pulse ring-2 ring-rose-500/40 shadow-rose-900/50"
                : "bg-slate-900 border border-rose-500/30 text-rose-400 hover:text-white hover:bg-rose-950/40"
            }`}
          >
            {hazardInjected ? "⚡ INJECTED: GAS LEAK ZONE B" : "⚡ Inject Gas Hazard (Zone B)"}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 grid grid-cols-1 xl:grid-cols-4 gap-6 p-6">
        
        {/* Heatmap Section */}
        <section className="xl:col-span-3 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h2 className="text-lg font-bold tracking-wider text-slate-300">2D Spatial Telemetry Heatmap</h2>
              <p className="text-xs text-slate-500">Live grid displaying gas concentration, thermal readings, and active permits</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> Low Risk</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> Moderate Risk</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-600"></span> Critical Risk</span>
            </div>
          </div>

          {/* Heatmap Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="heatmap-grid">
            {zones.map((zone) => {
              const isCritical = zone.risk_score > 0.70;
              const isModerate = zone.risk_score >= 0.40 && zone.risk_score <= 0.70;

              return (
                <div
                  key={zone.zone_id}
                  id={`zone-card-${zone.zone_id}`}
                  className={`relative rounded-xl border p-6 transition-all duration-500 overflow-hidden ${
                    isCritical
                      ? "bg-rose-950/30 border-rose-600 ring-2 ring-rose-500/20 animate-pulse shadow-lg shadow-rose-950/50"
                      : isModerate
                      ? "bg-amber-950/20 border-amber-600/70 shadow-md shadow-amber-950/30"
                      : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700/80"
                  }`}
                >
                  {/* Glowing alert aura */}
                  {isCritical && (
                    <div className="absolute -top-12 -right-12 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
                  )}

                  {/* Zone Header Info */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-base tracking-wide text-slate-200">{zone.name}</h3>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                          Permit: {zone.permit_type}
                        </span>
                      </div>
                    </div>
                    {/* Status Badge */}
                    <span className={`text-[10px] font-black tracking-widest px-2.5 py-1 rounded ${
                      isCritical
                        ? "bg-rose-500 text-white"
                        : isModerate
                        ? "bg-amber-500 text-slate-950"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}>
                      {zone.risk_level}
                    </span>
                  </div>

                  {/* Telemetry Readouts */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* Gas PPM */}
                    <div className="bg-slate-950/40 rounded-lg p-3 border border-slate-800/50">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        Gas PPM
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-2xl font-black ${isCritical ? "text-rose-400" : isModerate ? "text-amber-400" : "text-slate-200"}`}>
                          {zone.gas_ppm}
                        </span>
                        <span className="text-[10px] text-slate-500">PPM</span>
                      </div>
                    </div>

                    {/* Temp Celsius */}
                    <div className="bg-slate-950/40 rounded-lg p-3 border border-slate-800/50">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Temperature
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-slate-200">{zone.temperature}</span>
                        <span className="text-[10px] text-slate-500">°C</span>
                      </div>
                    </div>
                  </div>

                  {/* Compound Risk Progress Bar */}
                  <div>
                    <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                      <span className="text-slate-400">Compound Risk Index</span>
                      <span className={isCritical ? "text-rose-400 font-bold" : isModerate ? "text-amber-400" : "text-emerald-400"}>
                        {Math.round(zone.risk_score * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/50">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCritical
                            ? "bg-rose-500"
                            : isModerate
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${zone.risk_score * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Warning message if critical */}
                  {isCritical && zone.citation && (
                    <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] leading-relaxed">
                      <strong>ALERT:</strong> {zone.citation}
                    </div>
                  )}
                </div>
              );
            })}

            {zones.length === 0 && (
              <div className="col-span-3 py-16 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                <svg className="w-12 h-12 text-slate-600 animate-spin mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1-1.382-3H20v2m0-6H4" />
                </svg>
                <p className="text-sm font-semibold tracking-wide text-slate-400">Awaiting Real-time Telemetry Stream...</p>
                <p className="text-xs text-slate-600 mt-1">Make sure the Python backend is running on port 8000</p>
              </div>
            )}
          </div>

          {/* Plant Layout Blueprint Diagram */}
          <div className="mt-2 border border-slate-900 rounded-xl bg-slate-950/40 p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Plant Zone Layout Grid Layout</h3>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-500 select-none">
              <div className="border border-slate-800/40 py-6 rounded bg-slate-900/10">WEST SEGMENT [A]</div>
              <div className={`border py-6 rounded transition-colors duration-300 ${hazardInjected ? "border-rose-900/60 bg-rose-950/10 text-rose-500" : "border-slate-800/40 bg-slate-900/10"}`}>
                STORAGE TANKS [B] {hazardInjected && "⚠️"}
              </div>
              <div className="border border-slate-800/40 py-6 rounded bg-slate-900/10">EAST SEGMENT [C]</div>
            </div>
          </div>
        </section>

        {/* Live Sidebar Intelligence Feed */}
        <section className="xl:col-span-1 border border-slate-900 bg-slate-900/20 rounded-xl flex flex-col h-[calc(100vh-8.5rem)] overflow-hidden">
          <div className="border-b border-slate-900 bg-slate-950/50 p-4 flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Agent Intelligence Feed</h2>
          </div>

          {/* Agent Activity Scroll */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" id="agent-feed">
            {agentLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700/80 transition-all duration-300"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-semibold text-slate-500">{log.timestamp}</span>
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                    log.risk_level === "CRITICAL"
                      ? "bg-rose-500 text-white"
                      : "bg-amber-500 text-slate-950"
                  }`}>
                    {log.risk_level}
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-medium mb-3">
                  <span className="text-slate-400 font-bold block mb-1">Zone: {log.zone}</span>
                  {log.message}
                </div>

                {/* Compliance Citation */}
                {log.citation && (
                  <div className="p-2.5 rounded bg-rose-950/30 border border-rose-500/20 text-rose-300 text-[10.5px] leading-relaxed mb-3">
                    <div className="text-[9px] uppercase font-black tracking-widest text-rose-400 mb-1">Statutory Compliance Citation</div>
                    {log.citation}
                  </div>
                )}

                {/* Recommended Safety Actions */}
                {log.recommendations && log.recommendations.length > 0 && (
                  <div>
                    <div className="text-[9px] uppercase font-black tracking-widest text-slate-400 mb-1.5">Mitigation Action Directives</div>
                    <ul className="space-y-1.5 text-[10.5px] text-slate-400">
                      {log.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-rose-500 font-bold mt-0.5">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}

            {agentLogs.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
                <svg className="w-8 h-8 text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">No Agent Notifications</p>
                <p className="text-[10px] text-slate-600 mt-1">Platform operations nominal. Live agent tracking will populate here during compound hazards.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
