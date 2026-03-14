"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Wedding, Guest, WeddingFunction, SeatingTable } from "@/lib/types";
import { toast } from "sonner";

export default function SeatingPlanPage() {
  const params = useParams();
  const weddingId = params.id as string;

  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [functions, setFunctions] = useState<WeddingFunction[]>([]);
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [selectedFunctionId, setSelectedFunctionId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [guestFilter, setGuestFilter] = useState<'all' | 'bride' | 'groom' | 'both'>('all');
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newTableShape, setNewTableShape] = useState<'round' | 'rectangular'>('round');
  const [newTableCapacity, setNewTableCapacity] = useState(10);
  const [dragOverTableId, setDragOverTableId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [weddingRes, guestRes, funcRes] = await Promise.all([
      supabase.from("weddings").select("*").eq("id", weddingId).single(),
      supabase.from("guests").select("*").eq("wedding_id", weddingId).eq("overall_status", "confirmed"),
      supabase.from("wedding_functions").select("*").eq("wedding_id", weddingId).order("sort_order"),
    ]);

    if (weddingRes.data) setWedding(weddingRes.data);
    if (guestRes.data) setGuests(guestRes.data);
    if (funcRes.data) {
      setFunctions(funcRes.data);
      if (funcRes.data.length > 0 && !selectedFunctionId) {
        setSelectedFunctionId(funcRes.data[0].id);
      }
    }
    setLoading(false);
  }, [weddingId, selectedFunctionId]);

  const fetchTables = useCallback(async () => {
    if (!selectedFunctionId) return;
    
    const { data: tablesData } = await supabase
      .from("seating_tables")
      .select("*")
      .eq("function_id", selectedFunctionId)
      .order("name");

    const { data: assignmentsData } = await supabase
      .from("guest_seating")
      .select("*, guests(*)")
      .in("table_id", (tablesData || []).map(t => t.id));

    const enrichedTables = (tablesData || []).map(table => ({
      ...table,
      assigned_guests: (assignmentsData || [])
        .filter(a => a.table_id === table.id)
        .map(a => a.guests)
    }));

    setTables(enrichedTables);
  }, [selectedFunctionId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchTables(); }, [fetchTables]);

  const filteredGuests = guests.filter(g => 
    g.function_ids.includes(selectedFunctionId) &&
    !tables.some(t => t.assigned_guests?.some(ag => ag.id === g.id))
  ).filter(g => {
    const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = guestFilter === 'all' || g.side === guestFilter;
    return matchesSearch && matchesFilter;
  });

  async function handleAddTableSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTableName) return;

    const { error } = await supabase.from("seating_tables").insert({
      wedding_id: weddingId,
      function_id: selectedFunctionId,
      name: newTableName,
      capacity: newTableCapacity,
      shape: newTableShape
    });

    if (error) toast.error("Failed to add table");
    else {
      toast.success("Table added!");
      setNewTableName("");
      setIsAddingTable(false);
      fetchTables();
    }
  }

  async function handleAssignGuest(guestId: string, tableId: string) {
    const table = tables.find(t => t.id === tableId);
    if (table && table.assigned_guests && table.assigned_guests.length >= table.capacity) {
      toast.error("Table is at full capacity!");
      return;
    }

    const { error } = await supabase.from("guest_seating").insert({
      guest_id: guestId,
      table_id: tableId
    });

    if (error) toast.error("Failed to assign guest");
    else {
      fetchTables();
    }
  }

  async function handleUnassignGuest(guestId: string, tableId: string) {
    const { error } = await supabase
      .from("guest_seating")
      .delete()
      .eq("guest_id", guestId)
      .eq("table_id", tableId);

    if (error) toast.error("Failed to unassign guest");
    else {
      fetchTables();
    }
  }

  async function handleDeleteTable(tableId: string) {
    if (!confirm("Are you sure you want to delete this table? All assignments will be lost.")) return;
    
    const { error } = await supabase.from("seating_tables").delete().eq("id", tableId);
    if (error) toast.error("Failed to delete table");
    else {
      toast.success("Table deleted");
      fetchTables();
    }
  }

  if (loading) return <div className="p-8 animate-pulse text-slate-400 text-center flex flex-col items-center justify-center min-h-[400px]">
    <span className="material-symbols-outlined text-6xl mb-4 animate-bounce">table_restaurant</span>
    <p className="font-bold text-xl tracking-tight">Loading Interactive Seating Canvas...</p>
  </div>;

  return (
    <div className="space-y-8 pb-32 bg-[#FDFCFB]/50 min-h-screen -m-8 p-8">
      {/* Header */}
      <div className="flex justify-between items-center bg-white/40 backdrop-blur-md p-6 -mx-8 -mt-8 border-b border-slate-100 mb-8 px-8 sticky top-0 z-50">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             Interactive Seating Plan Canvas
          </h2>
          <p className="text-slate-500 font-medium text-sm">Design and manage guest arrangements for your special events</p>
        </div>
        <div className="flex gap-6 items-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Select Event</span>
            <div className="relative">
               <select
                value={selectedFunctionId}
                onChange={(e) => setSelectedFunctionId(e.target.value)}
                className="appearance-none bg-white border-2 border-slate-100 rounded-xl pl-4 pr-10 py-2.5 font-bold text-slate-700 outline-none focus:border-primary/50 transition-all shadow-sm hover:border-slate-200 cursor-pointer min-w-[200px]"
              >
                {functions.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>
          <button
            onClick={() => setIsAddingTable(true)}
            className="flex items-center gap-2 px-8 py-3 bg-[#B45309] text-white rounded-2xl font-black hover:shadow-2xl hover:shadow-[#B45309]/30 transition-all active:scale-95 group"
          >
            <span className="material-symbols-outlined group-hover:rotate-90 transition-transform">add_circle</span>
            Add Table
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 relative z-10">
        {/* Guest Sidebar */}
        <div className="col-span-12 lg:col-span-4 flex flex-col h-[calc(100vh-12rem)] sticky top-[104px]">
          <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-100 shadow-2xl shadow-slate-200/50 flex flex-col h-full overflow-hidden">
            {/* Search and Filters Section */}
            <div className="p-6 border-b border-slate-50 space-y-4 bg-slate-50/30">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-slate-900 uppercase tracking-[0.2em] text-[10px]">Guests Pool</h3>
                <span className="bg-slate-900 text-white text-[10px] px-3 py-1 rounded-full font-black flex items-center gap-1.5 shadow-lg shadow-slate-900/10">
                  <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span>
                  {filteredGuests.length} Remaining
                </span>
              </div>
              
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl group-focus-within:text-primary transition-colors">search</span>
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-50 focus:border-primary/20 rounded-2xl text-sm font-bold transition-all focus:outline-none shadow-sm placeholder:text-slate-300"
                />
              </div>

              <div className="flex gap-1.5 bg-slate-100/40 p-1 rounded-2xl border border-slate-100">
                {(['all', 'bride', 'groom', 'both'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setGuestFilter(filter)}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                      guestFilter === filter 
                        ? 'bg-white text-slate-900 shadow-xl shadow-slate-200/50 border border-slate-100' 
                        : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Guest List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {filteredGuests.length === 0 ? (
                <div className="text-center py-20 flex flex-col items-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mb-4 text-slate-200">
                    <span className="material-symbols-outlined text-4xl">person_off</span>
                  </div>
                  <p className="text-slate-400 text-sm font-bold">No unassigned guests</p>
                </div>
              ) : (
                filteredGuests.map((g) => (
                  <div 
                    key={g.id} 
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("guestId", g.id);
                      e.currentTarget.style.opacity = '0.5';
                      e.currentTarget.style.transform = 'scale(0.95)';
                    }}
                    onDragEnd={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group cursor-grab active:cursor-grabbing hover:border-[#B45309]/30 hover:shadow-xl hover:shadow-[#B45309]/5 transition-all relative overflow-hidden active:scale-95 translate-y-0 hover:-translate-y-1"
                  >
                    <div className="flex flex-col gap-1 relative z-10">
                      <span className="font-black text-slate-800 group-hover:text-[#B45309] transition-colors tracking-tight">{g.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                          g.side === 'bride' ? 'bg-pink-50 text-pink-500 border border-pink-100' :
                          g.side === 'groom' ? 'bg-blue-50 text-blue-500 border border-blue-100' :
                          'bg-slate-50 text-slate-500 border border-slate-100'
                        }`}>
                          {g.side} side
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-200 group-hover:text-[#B45309]/40 transition-colors relative z-10">drag_indicator</span>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-transparent to-slate-50/50 rounded-full translate-x-12 -translate-y-12"></div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Tables Canvas Area */}
        <div className="col-span-12 lg:col-span-8">
          <div className="relative min-h-[calc(100vh-12rem)] bg-white/40 backdrop-blur-md rounded-[4rem] border border-white/80 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.05)] p-12 overflow-hidden group/canvas">
            {/* Grid Background */}
            <div className="absolute inset-0 opacity-[0.07] pointer-events-none transition-opacity group-hover/canvas:opacity-10" style={{ 
              backgroundImage: `radial-gradient(#B45309 1.5px, transparent 1.5px)`,
              backgroundSize: '36px 36px'
            }}></div>

            {tables.length === 0 ? (
              <div className="relative z-10 h-full flex flex-col items-center justify-center py-32 text-center animate-in fade-in zoom-in duration-700">
                <div className="w-32 h-32 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center mb-8 rotate-6 hover:rotate-0 transition-transform duration-500 border border-slate-50">
                  <span className="material-symbols-outlined text-[#B45309] text-6xl">table_restaurant</span>
                </div>
                <h3 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Empty Canvas</h3>
                <p className="text-slate-500 mb-10 font-medium max-w-sm mx-auto leading-relaxed">Start designing your venue layout by creating your first guest table. Choose from round or rectangular styles.</p>
                <button
                  onClick={() => setIsAddingTable(true)}
                  className="px-10 py-5 bg-[#B45309] text-white rounded-3xl font-black hover:shadow-[0_20px_40px_-12px_rgba(180,83,9,0.4)] transition-all active:scale-90 flex items-center gap-3"
                >
                  <span className="material-symbols-outlined">auto_fix</span>
                  Initialize Plan
                </button>
              </div>
            ) : (
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12">
                {tables.map(table => {
                  const seatedCount = table.assigned_guests?.length || 0;
                  const isFull = seatedCount >= table.capacity;
                  const isDragOver = dragOverTableId === table.id;
                  const fillPercentage = (seatedCount / table.capacity) * 100;
                  
                  return (
                    <div
                      key={table.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverTableId(table.id);
                      }}
                      onDragLeave={() => setDragOverTableId(null)}
                      onDrop={(e) => {
                        setDragOverTableId(null);
                        const guestId = e.dataTransfer.getData("guestId");
                        handleAssignGuest(guestId, table.id);
                      }}
                      className={`relative bg-white border-[3px] transition-all p-10 group rounded-[3.5rem] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.04)] hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.08)] ${
                        isDragOver ? "border-[#B45309] scale-[1.02] bg-orange-50/20" : 
                        activeTableId === table.id ? "border-[#B45309]/40" : "border-slate-50 hover:border-slate-100"
                      }`}
                      onClick={() => setActiveTableId(table.id)}
                    >
                      {/* Table Header */}
                      <div className="flex justify-between items-start mb-12 relative z-30">
                        <div>
                          <h4 className="font-black text-slate-900 text-xl uppercase tracking-tighter">{table.name}</h4>
                          <span className={`text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-widest mt-3 inline-flex items-center gap-2 ${
                            isFull ? "bg-red-50 text-red-500 border border-red-100" : "bg-orange-50 text-[#B45309] border border-orange-100"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isFull ? 'bg-red-500' : 'bg-orange-500 animate-pulse'}`}></span>
                            {seatedCount} / {table.capacity} SEATS OCCUPIED
                          </span>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id); }}
                          className="opacity-0 group-hover:opacity-100 text-slate-200 hover:text-red-500 transition-all p-2.5 hover:bg-red-50 rounded-2xl border border-transparent hover:border-red-100 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-xl">delete_sweep</span>
                        </button>
                      </div>

                      {/* Visual Table Representation */}
                      <div className="relative w-64 h-64 mx-auto mb-12 flex items-center justify-center">
                        {table.shape === 'round' ? (
                          <>
                            {/* Round Table UI */}
                            <div className="absolute inset-0 rounded-full border-[10px] border-slate-50/50"></div>
                            <svg className="absolute inset-0 w-full h-full -rotate-90 z-20 pointer-events-none">
                              <circle
                                cx="50%"
                                cy="50%"
                                r="44%"
                                fill="none"
                                stroke="#B45309"
                                strokeWidth="8"
                                strokeDasharray="278"
                                strokeDashoffset={278 - (278 * fillPercentage) / 100}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-in-out"
                              />
                            </svg>
                            <div className="w-36 h-36 rounded-full bg-white shadow-2xl flex items-center justify-center border-4 border-slate-50 relative z-10 transition-transform group-hover:scale-105 duration-500">
                               <div className="absolute inset-4 rounded-full border-2 border-dashed border-slate-100 animate-[spin_20s_linear_infinite]"></div>
                               <span className="material-symbols-outlined text-[#B45309]/10 text-5xl">restaurant</span>
                            </div>
                            
                            {/* Seats Around Round Table */}
                            {Array.from({ length: table.capacity }).map((_, i) => {
                              const angle = (i * 360) / table.capacity;
                              const radius = 100;
                              const x = Math.cos((angle * Math.PI) / 180) * radius;
                              const y = Math.sin((angle * Math.PI) / 180) * radius;
                              const guest = table.assigned_guests?.[i];
                              
                              return (
                                <div 
                                  key={i}
                                  className={`absolute w-11 h-11 rounded-full border-[3px] transition-all duration-700 z-30 flex items-center justify-center group/seat shadow-sm ${
                                    guest ? "bg-white border-[#B45309] text-[#B45309] scale-110 rotate-0" : "bg-slate-50 border-white text-transparent rotate-45 scale-90"
                                  }`}
                                  style={{ 
                                    transform: `translate(${x}px, ${y}px)`,
                                    transitionDelay: `${i * 40}ms`
                                  }}
                                >
                                  {guest ? (
                                    <span className="text-[11px] font-black uppercase tracking-tight">
                                      {guest.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </span>
                                  ) : (
                                    <span className="material-symbols-outlined text-slate-200 text-xs">chair</span>
                                  )}
                                  
                                  {/* Tooltip on Hover */}
                                  {guest && (
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold opacity-0 group-hover/seat:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-xl">
                                      {guest.name}
                                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <>
                            {/* Rectangular Table UI */}
                            <div className="w-56 h-32 bg-white border border-slate-100 rounded-[2rem] shadow-2xl flex items-center justify-center relative z-10 hover:scale-105 transition-transform duration-500">
                              <div className="absolute inset-0 rounded-[2rem] border-[8px] border-slate-50/50"></div>
                              <span className="material-symbols-outlined text-[#B45309]/10 text-5xl rotate-90">restaurant</span>
                              
                              {/* Bottom Progress bar for rectangular */}
                              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-50/80 overflow-hidden rounded-b-[2rem]">
                                <div className="h-full bg-[#B45309] transition-all duration-1000 ease-out rounded-full" style={{ width: `${fillPercentage}%` }} />
                              </div>
                            </div>

                            {/* Seats Around Rectangular Table */}
                            {Array.from({ length: table.capacity }).map((_, i) => {
                              const side = i < table.capacity / 2 ? 'top' : 'bottom';
                              const countPerSide = table.capacity / 2;
                              const indexOnSide = i % countPerSide;
                              const offsetX = (indexOnSide - (countPerSide - 1) / 2) * 52;
                              const offsetY = side === 'top' ? -80 : 80;
                              const guest = table.assigned_guests?.[i];

                              return (
                                <div 
                                  key={i}
                                  className={`absolute w-11 h-11 rounded-2xl border-[3px] transition-all duration-700 z-30 flex items-center justify-center group/seat shadow-sm ${
                                    guest ? "bg-white border-[#B45309] text-[#B45309] scale-110" : "bg-slate-50 border-white text-transparent scale-90"
                                  }`}
                                  style={{ 
                                    transform: `translate(${offsetX}px, ${offsetY}px)`,
                                    transitionDelay: `${i * 40}ms`
                                  }}
                                >
                                  {guest ? (
                                    <span className="text-[11px] font-black uppercase tracking-tight">
                                      {guest.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </span>
                                  ) : (
                                    <span className="material-symbols-outlined text-slate-200 text-xs">chair</span>
                                  )}

                                  {/* Tooltip on Hover */}
                                  {guest && (
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold opacity-0 group-hover/seat:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-xl border border-white/10">
                                      {guest.name}
                                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>

                      {/* Guest Details List on Hover/Select */}
                      <div className="opacity-0 group-hover:opacity-100 transition-all duration-500 space-y-2.5 mt-4 max-h-40 overflow-y-auto pr-3 custom-scrollbar translate-y-2 group-hover:translate-y-0">
                        {seatedCount > 0 ? (
                           table.assigned_guests?.map(guest => (
                            <div key={guest.id} className="flex items-center justify-between p-3 bg-white border border-slate-50 rounded-2xl hover:border-[#B45309]/20 transition-all shadow-sm group/row">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 bg-[#B45309]/10 rounded-full flex items-center justify-center text-[#B45309] text-[10px] font-black">
                                  {guest.name[0]}
                                </div>
                                <span className="text-[11px] font-black text-slate-700">{guest.name}</span>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUnassignGuest(guest.id, table.id); }}
                                className="text-slate-200 hover:text-red-500 transition-colors bg-white hover:bg-red-50 w-7 h-7 rounded-full border border-transparent hover:border-red-100 flex items-center justify-center focus:outline-none"
                              >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 border-2 border-dashed border-slate-100 rounded-2xl transition-colors group-hover:border-slate-200 group-hover:bg-slate-50/50">
                             <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Awaiting Guest Assignments</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Table Modal */}
      {isAddingTable && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in transition-opacity" onClick={() => setIsAddingTable(false)}>
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[3rem] p-10 w-full max-w-lg shadow-[0_32px_128px_-16px_rgba(0,0,0,0.3)] border border-white relative overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-500"
          >
            {/* Modal Decorations */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary/50 via-primary to-primary/50"></div>
            
            <div className="flex justify-between items-center mb-10">
              <div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Create Table</h3>
                <p className="text-slate-500 font-medium text-sm mt-1">Configure your new seating arrangement</p>
              </div>
              <button 
                onClick={() => setIsAddingTable(false)} 
                className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all active:scale-95"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddTableSubmit} className="space-y-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Unique Table Name</label>
                  <input
                    type="text"
                    placeholder="e.g. VIP Lounge or Family A"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-900 outline-none focus:border-primary/30 focus:bg-white transition-all shadow-sm placeholder:text-slate-300"
                    autoFocus
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Geometric Shape</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setNewTableShape('round')}
                        className={`flex-1 flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all group ${
                          newTableShape === 'round' ? 'border-[#B45309] bg-[#B45309]/5 text-[#B45309]' : 'border-slate-50 text-slate-400 bg-slate-50/50 hover:bg-slate-50'
                        }`}
                      >
                        <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">radio_button_unchecked</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">Circular</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewTableShape('rectangular')}
                        className={`flex-1 flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all group ${
                          newTableShape === 'rectangular' ? 'border-[#B45309] bg-[#B45309]/5 text-[#B45309]' : 'border-slate-50 text-slate-400 bg-slate-50/50 hover:bg-slate-50'
                        }`}
                      >
                        <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">rectangle</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">Angular</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Guest Capacity</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="2"
                        max="24"
                        value={newTableCapacity}
                        onChange={(e) => setNewTableCapacity(parseInt(e.target.value))}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-900 outline-none focus:border-primary/30 focus:bg-white transition-all shadow-sm appearance-none"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-1">
                         <span className="material-symbols-outlined text-slate-400 text-sm cursor-pointer hover:text-primary">expand_less</span>
                         <span className="material-symbols-outlined text-slate-400 text-sm cursor-pointer hover:text-primary">expand_more</span>
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-tighter">* Maximum recommended is 24 seats</p>
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-5 bg-[#B45309] text-white rounded-[2rem] font-black text-lg hover:shadow-[0_20px_40px_-12px_rgba(180,83,9,0.5)] border-t-4 border-white/20 transition-all active:scale-95 flex items-center justify-center gap-3 mt-4 group"
              >
                Initialize Seating Unit
                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </button>
            </form>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
