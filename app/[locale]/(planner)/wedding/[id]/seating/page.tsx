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

  if (loading) return <div className="p-8 animate-pulse text-slate-400">Loading seating plan...</div>;

  return (
    <div className="space-y-8 pb-32 bg-[#FDFCFB] min-h-screen -m-8 p-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Interactive Seating Plan Canvas</h2>
          <p className="text-slate-500 font-medium">Assign confirmed guests to tables for each function</p>
        </div>
        <div className="flex gap-6 items-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Select Event</span>
            <select
              value={selectedFunctionId}
              onChange={(e) => setSelectedFunctionId(e.target.value)}
              className="bg-white border-2 border-slate-100 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-primary transition-all shadow-sm"
            >
              {functions.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setIsAddingTable(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#B45309] text-white rounded-xl font-bold hover:shadow-lg hover:shadow-[#B45309]/20 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Add Table
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 relative z-10">
        {/* Guest Sidebar */}
        <div className="col-span-12 lg:col-span-4 flex flex-col h-[calc(100vh-16rem)] sticky top-8">
          <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col h-full overflow-hidden">
            {/* Search and Filters Section */}
            <div className="p-6 border-b border-slate-50 space-y-4 bg-slate-50/30">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Guests</h3>
                <span className="bg-slate-900 text-white text-[10px] px-2.5 py-1 rounded-full font-black">
                  {filteredGuests.length} Remaining
                </span>
              </div>
              
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                <input
                  type="text"
                  placeholder="Search guest name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-primary/50 rounded-xl text-sm font-medium transition-all focus:outline-none shadow-sm"
                />
              </div>

              <div className="flex gap-1 bg-slate-100/50 p-1.5 rounded-xl">
                {(['all', 'bride', 'groom', 'both'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setGuestFilter(filter)}
                    className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                      guestFilter === filter 
                        ? 'bg-white text-slate-900 shadow-sm' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Guest List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredGuests.length === 0 ? (
                <div className="text-center py-16">
                  <span className="material-symbols-outlined text-slate-100 text-6xl mb-4">task_alt</span>
                  <p className="text-slate-400 text-sm font-bold">No guests found</p>
                </div>
              ) : (
                filteredGuests.map((g) => (
                  <div 
                    key={g.id} 
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("guestId", g.id);
                      e.currentTarget.style.opacity = '0.5';
                      e.currentTarget.style.transform = 'scale(0.98)';
                    }}
                    onDragEnd={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group cursor-grab active:cursor-grabbing hover:border-[#B45309]/30 hover:shadow-lg hover:shadow-[#B45309]/5 transition-all"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-slate-800 group-hover:text-[#B45309] transition-colors">{g.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                          g.side === 'bride' ? 'bg-pink-50 text-pink-500' :
                          g.side === 'groom' ? 'bg-blue-50 text-blue-500' :
                          'bg-slate-50 text-slate-500'
                        }`}>
                          {g.side} side
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-200 group-hover:text-[#B45309]/40 transition-colors">drag_indicator</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Tables Canvas Area */}
        <div className="col-span-12 lg:col-span-8">
          <div className="relative min-h-[calc(100vh-16rem)] bg-white/40 backdrop-blur-md rounded-[3rem] border border-white shadow-2xl p-10 overflow-hidden">
            {/* Grid Background */}
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ 
              backgroundImage: `radial-gradient(#B45309 1.5px, transparent 1.5px)`,
              backgroundSize: '32px 32px'
            }}></div>

            {tables.length === 0 ? (
              <div className="relative z-10 h-full flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6 rotate-3">
                  <span className="material-symbols-outlined text-[#B45309] text-5xl">table_restaurant</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">No tables created yet</h3>
                <p className="text-slate-500 mb-8 font-medium max-w-xs mx-auto">Design your venue layout and start assigning guests to their seats.</p>
                <button
                  onClick={() => setIsAddingTable(true)}
                  className="px-8 py-4 bg-[#B45309] text-white rounded-2xl font-black hover:shadow-2xl hover:shadow-[#B45309]/30 transition-all active:scale-95"
                >
                  Create Your First Table
                </button>
              </div>
            ) : (
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-10">
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
                      className={`relative bg-white/90 backdrop-blur-md rounded-[2.5rem] border-2 transition-all p-8 group overflow-hidden ${
                        isDragOver ? "border-[#B45309] bg-white scale-[1.03] shadow-2xl shadow-[#B45309]/10" : 
                        activeTableId === table.id ? "border-[#B45309]/50 shadow-xl" : "border-slate-100 hover:border-slate-200 shadow-sm"
                      }`}
                      onClick={() => setActiveTableId(table.id)}
                    >
                      {/* Table Header */}
                      <div className="flex justify-between items-start mb-10 relative z-10">
                        <div>
                          <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">{table.name}</h4>
                          <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest mt-2 inline-block ${
                            isFull ? "bg-red-50 text-red-500" : "bg-[#B45309]/10 text-[#B45309]"
                          }`}>
                            {seatedCount} / {table.capacity} SEATS FILLED
                          </span>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id); }}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-2 hover:bg-red-50 rounded-xl"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>

                      {/* Visual Table Representation */}
                      <div className="relative w-56 h-56 mx-auto mb-10 flex items-center justify-center">
                        {table.shape === 'round' ? (
                          <>
                            {/* Round Table UI */}
                            <svg className="absolute inset-0 w-full h-full -rotate-90">
                              <circle
                                cx="50%"
                                cy="50%"
                                r="45%"
                                fill="none"
                                stroke="#f8fafc"
                                strokeWidth="4"
                              />
                              <circle
                                cx="50%"
                                cy="50%"
                                r="45%"
                                fill="none"
                                stroke="#B45309"
                                strokeWidth="4"
                                strokeDasharray="283"
                                strokeDashoffset={283 - (283 * fillPercentage) / 100}
                                className="transition-all duration-1000 ease-out"
                              />
                            </svg>
                            <div className="w-32 h-32 rounded-full bg-white shadow-xl flex items-center justify-center border border-slate-50 relative z-10">
                              <span className="material-symbols-outlined text-slate-100 text-4xl">restaurant</span>
                            </div>
                            
                            {/* Seats Around Round Table */}
                            {Array.from({ length: table.capacity }).map((_, i) => {
                              const angle = (i * 360) / table.capacity;
                              const radius = 95;
                              const x = Math.cos((angle * Math.PI) / 180) * radius;
                              const y = Math.sin((angle * Math.PI) / 180) * radius;
                              const guest = table.assigned_guests?.[i];
                              
                              return (
                                <div 
                                  key={i}
                                  className={`absolute w-14 h-14 rounded-full border-[4px] transition-all duration-700 z-30 flex items-center justify-center group/seat shadow-lg ${
                                    guest ? "bg-white border-[#B45309] text-[#B45309] scale-110" : "bg-slate-50 border-slate-100 text-slate-200 scale-[0.8]"
                                  }`}
                                  style={{ 
                                    transform: `translate(${x}px, ${y}px)`,
                                    transitionDelay: `${i * 30}ms`
                                  }}
                                >
                                  {guest ? (
                                    <span className="text-[13px] font-black uppercase">
                                      {guest.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </span>
                                  ) : (
                                    <span className="material-symbols-outlined text-lg">chair</span>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <>
                            {/* Rectangular Table UI */}
                            <div className="w-64 h-36 bg-white border border-[#E7D9D0]/50 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.06)] flex items-center justify-center relative z-10 transition-transform group-hover:scale-[1.03]">
                              <div className="absolute inset-0 rounded-[2.5rem] border-[10px] border-slate-50/50"></div>
                              <span className="material-symbols-outlined text-[#B45309]/10 text-6xl">restaurant</span>
                            </div>

                            {/* Seats Around Rectangular Table */}
                            {Array.from({ length: table.capacity }).map((_, i) => {
                              const guest = table.assigned_guests?.[i];
                              let offsetX = 0;
                              let offsetY = 0;
                              
                              // Positioning Logic: Ends (Left/Right) and Sides (Top/Bottom)
                              const endSeatsCount = table.capacity >= 8 ? 2 : 1;
                              const totalEndSeats = endSeatsCount * 2;
                              
                              if (i < endSeatsCount) {
                                // Left Side
                                offsetX = -165;
                                offsetY = (i - (endSeatsCount - 1) / 2) * 85;
                              } else if (i < totalEndSeats) {
                                // Right Side
                                offsetX = 165;
                                const indexOnSide = i - endSeatsCount;
                                offsetY = (indexOnSide - (endSeatsCount - 1) / 2) * 85;
                              } else {
                                // Top and Bottom Sides
                                const remainingIdx = i - totalEndSeats;
                                const seatsPerLongSide = Math.ceil((table.capacity - totalEndSeats) / 2);
                                const isOnTop = remainingIdx < seatsPerLongSide;
                                const indexOnSide = remainingIdx % seatsPerLongSide;
                                offsetX = (indexOnSide - (seatsPerLongSide - 1) / 2) * 78;
                                offsetY = isOnTop ? -100 : 100;
                              }

                              return (
                                <div 
                                  key={i}
                                  className={`absolute w-14 h-14 rounded-[1.2rem] border-[4px] transition-all duration-700 z-30 flex items-center justify-center group/seat shadow-lg ${
                                    guest ? "bg-white border-[#B45309] text-[#B45309] scale-110 shadow-xl" : "bg-slate-50 border-slate-100 text-slate-200 scale-[0.8]"
                                  }`}
                                  style={{ 
                                    transform: `translate(${offsetX}px, ${offsetY}px)`,
                                    transitionDelay: `${i * 30}ms`
                                  }}
                                >
                                  {guest ? (
                                    <span className="text-[13px] font-black uppercase tracking-tighter">
                                      {guest.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </span>
                                  ) : (
                                    <span className="material-symbols-outlined text-lg">chair</span>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>

                      {/* Guest Details List - Polished to match screenshot */}
                      <div className="space-y-2 mt-10 max-h-60 overflow-y-auto pr-3 custom-scrollbar">
                        {seatedCount > 0 ? (
                           table.assigned_guests?.map(guest => (
                            <div key={guest.id} className="flex items-center justify-between p-3.5 bg-white border border-[#F8F9FA] rounded-[1.5rem] hover:border-[#B45309]/20 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)] group/row">
                              <div className="flex items-center gap-3.5">
                                <div className="w-8 h-8 bg-[#FFF4ED] border border-orange-100/50 rounded-xl flex items-center justify-center text-[#B45309] text-[10px] font-black">
                                  {guest.name[0]}
                                </div>
                                <span className="text-[13px] font-black text-slate-700 tracking-tight">{guest.name}</span>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUnassignGuest(guest.id, table.id); }}
                                className="text-slate-300 hover:text-red-500 transition-all bg-white hover:bg-red-50 w-7 h-7 rounded-full border border-transparent flex items-center justify-center"
                              >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-slate-400 text-sm font-medium">Drag guests here to assign them to this table.</p>
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsAddingTable(false)}>
          <form 
            onSubmit={handleAddTableSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-white"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Add New Table</h3>
              <button onClick={() => setIsAddingTable(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Table Name</label>
                <input
                  type="text"
                  placeholder="e.g. VIP Table 1"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none focus:border-primary focus:bg-white transition-all"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Shape</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewTableShape('round')}
                      className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                        newTableShape === 'round' ? 'border-[#B45309] bg-[#B45309]/5 text-[#B45309]' : 'border-slate-100 text-slate-400'
                      }`}
                    >
                      <span className="material-symbols-outlined">circle</span>
                      <span className="text-[10px] font-black uppercase">Round</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTableShape('rectangular')}
                      className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                        newTableShape === 'rectangular' ? 'border-[#B45309] bg-[#B45309]/5 text-[#B45309]' : 'border-slate-100 text-slate-400'
                      }`}
                    >
                      <span className="material-symbols-outlined">rectangle</span>
                      <span className="text-[10px] font-black uppercase">Rectangle</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Capacity</label>
                  <input
                    type="number"
                    min="2"
                    max="20"
                    value={newTableCapacity}
                    onChange={(e) => setNewTableCapacity(parseInt(e.target.value))}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none focus:border-primary focus:bg-white transition-all"
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full py-4 bg-[#B45309] text-white rounded-2xl font-black hover:shadow-xl hover:shadow-[#B45309]/20 transition-all active:scale-95"
              >
                Create Table
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
