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
  const [isEventSelectorOpen, setIsEventSelectorOpen] = useState(false);
  const [targetSeatingPercent, setTargetSeatingPercent] = useState<number>(100);
  const [isAiAssigning, setIsAiAssigning] = useState(false);
  const [isDeletingTable, setIsDeletingTable] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<SeatingTable | null>(null);

  // Close custom dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isEventSelectorOpen) {
        setIsEventSelectorOpen(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isEventSelectorOpen]);

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

  const filteredGuests = guests.filter(g => {
    // Basic filter: Guest must be invited to this function
    const isForFunction = g.function_ids.includes(selectedFunctionId);
    if (!isForFunction) return false;

    // Assignment filter: By default only show unassigned guests, 
    // but show matched assigned guests when searching
    const isAssigned = tables.some(t => t.assigned_guests?.some(ag => ag.id === g.id));
    const isSearching = searchQuery.trim().length > 0;
    
    if (!isSearching && isAssigned) return false;

    // Search and Category filters
    const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = guestFilter === 'all' || g.side === guestFilter;
    
    return matchesSearch && matchesCategory;
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

  async function handleDeleteTable(table: SeatingTable) {
    setTableToDelete(table);
    setIsDeletingTable(true);
  }

  async function confirmDeleteTable() {
    if (!tableToDelete) return;
    
    const { error } = await supabase.from("seating_tables").delete().eq("id", tableToDelete.id);
    if (error) toast.error("Failed to delete table");
    else {
      toast.success("Table deleted");
      fetchTables();
    }
    setIsDeletingTable(false);
    setTableToDelete(null);
  }

  async function handleAutoSeat() {
    if (!selectedFunctionId) return;
    
    // Calculate unassigned guests (exclude those already in Tables)
    const unassignedGuests = guests.filter(g => {
      // Must be invited to this function
      if (!g.function_ids.includes(selectedFunctionId)) return false;
      // Must NOT be assigned to a table
      const isAssigned = tables.some(t => t.assigned_guests?.some(ag => ag.id === g.id));
      return !isAssigned;
    });

    if (unassignedGuests.length === 0) {
      toast.info("All confirmed guests are already seated.");
      return;
    }

    const targetSeatingCount = Math.floor(unassignedGuests.length * (targetSeatingPercent / 100));
    
    if (targetSeatingCount === 0) {
      toast.info("Target seating is set to 0. Move the slider to seat guests.");
      return;
    }

    setIsAiAssigning(true);
    const toastId = toast.loading("AI is analyzing relationships, creating tables, and assigning seats... This may take a moment.");

    try {
      const response = await fetch(`/api/wedding/${weddingId}/ai-seat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tables: tables.map(t => ({ id: t.id, name: t.name, capacity: t.capacity, assigned_guests: t.assigned_guests || [] })),
          unassignedGuests: unassignedGuests.map(g => ({ id: g.id, name: g.name, side: g.side, group_id: g.group_id })),
          targetSeatingCount,
          functionId: selectedFunctionId
        })
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Failed to run AI seating");

      toast.success(`✨ Assigned ${result.seatedCount} guests! Created ${result.newTablesCreated} new tables.`, { id: toastId });
      fetchTables();
      
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to complete AI seating.", { id: toastId });
    } finally {
      setIsAiAssigning(false);
    }
  }

  if (loading) return <div className="p-8 animate-pulse text-slate-400">Loading seating plan...</div>;

  return (
    <div className="space-y-8 pb-32 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-1">Seating Plan</h2>
          <p className="text-slate-500 font-medium text-lg">Assign confirmed guests to tables for each function</p>
        </div>
        
        {/* Controls Toolbar - Premium Pill Design */}
        <div className="flex bg-white rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 p-1.5 flex-nowrap items-center shrink-0 ml-4 max-w-full relative z-[50]">
          
          {/* 1. Event Selector */}
          <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsEventSelectorOpen(!isEventSelectorOpen)}
              className="flex items-center justify-between gap-3 px-5 py-3 rounded-full hover:bg-slate-50 transition-all font-black text-[13px] text-slate-700 w-[170px] outline-none"
            >
              <span className="truncate">{functions.find(f => f.id === selectedFunctionId)?.name || "Select Event"}</span>
              <span className={`material-symbols-outlined text-[18px] text-slate-400 shrink-0 transition-transform duration-300 ${isEventSelectorOpen ? 'rotate-180' : ''}`}>
                keyboard_arrow_down
              </span>
            </button>
            
            {/* Custom Dropdown Menu */}
            {isEventSelectorOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.1)] overflow-hidden z-[100] animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="p-1.5 flex flex-col gap-0.5">
                  {functions.filter(f => f.id !== selectedFunctionId).map(f => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setSelectedFunctionId(f.id);
                        setIsEventSelectorOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 rounded-xl text-[13px] font-black transition-all flex items-center justify-between text-slate-600 hover:bg-[#B45309]/5 hover:text-[#B45309]"
                    >
                      <span className="truncate pr-2">{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-8 bg-slate-200 mx-2 shrink-0"></div>

          {/* 2. Seat Target Slider */}
          <div className="flex items-center gap-3 px-3 w-[190px] shrink-0" title="Percentage of unassigned guests to auto-seat">
            <span className="text-[11px] font-black text-slate-400 tracking-wider shrink-0">TARGET</span>
            <input 
              type="range" 
              min="10" 
              max="100" 
              step="10" 
              value={targetSeatingPercent} 
              onChange={(e) => setTargetSeatingPercent(Number(e.target.value))}
              disabled={isAiAssigning}
              className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-[#B45309] hover:accent-[#92400e] transition-all disabled:opacity-50"
            />
            <span className="text-[12px] font-black text-[#B45309] w-8 text-right shrink-0">{targetSeatingPercent}%</span>
          </div>

          <div className="w-px h-8 bg-slate-200 mx-2 shrink-0"></div>

          {/* 3. Action Buttons */}
          <div className="flex items-center gap-2 pr-1 ml-1 shrink-0">
            <button
              onClick={handleAutoSeat}
              disabled={isAiAssigning}
              className={`flex items-center gap-2 px-5 py-3 rounded-full font-black text-[13px] uppercase tracking-wide whitespace-nowrap shrink-0 transition-all ${
                isAiAssigning 
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed" 
                  : "bg-[#FFF4ED] text-[#B45309] hover:bg-[#FFE8D6] active:scale-95"
              }`}
            >
              <span className={`material-symbols-outlined text-[18px] shrink-0 ${isAiAssigning ? 'animate-spin' : ''}`}>
                {isAiAssigning ? 'sync' : 'magic_button'}
              </span>
              <span>Auto-Seat (AI)</span>
            </button>
            <button
              onClick={() => setIsAddingTable(true)}
              disabled={isAiAssigning}
              className="flex items-center gap-2 px-5 py-3 bg-[#B45309] text-white rounded-full font-black text-[13px] uppercase tracking-wide whitespace-nowrap shrink-0 hover:shadow-[0_8px_16px_rgb(180,83,9,0.3)] hover:-translate-y-0.5 transition-all active:scale-95 active:translate-y-0 disabled:opacity-50 border border-transparent"
            >
              <span className="material-symbols-outlined text-[18px] shrink-0">add_circle</span>
              <span>Add Table</span>
            </button>
          </div>
          
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 relative z-10 items-stretch">
        {/* Guest Sidebar */}
        <div className="col-span-12 lg:col-span-4 flex flex-col">
          <div className="sticky top-8 bg-white/80 backdrop-blur-xl rounded-[3rem] border border-white shadow-2xl flex flex-col h-[calc(100vh-12rem)] overflow-hidden">
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
                filteredGuests.map((g) => {
                  const assignedTable = tables.find(t => t.assigned_guests?.some(ag => ag.id === g.id));
                  
                  return (
                    <div 
                      key={g.id} 
                      draggable={!assignedTable}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("guestId", g.id);
                        e.currentTarget.style.opacity = '0.5';
                        e.currentTarget.style.transform = 'scale(0.98)';
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                      onClick={() => {
                        if (assignedTable) {
                          const tableElement = document.getElementById(`table-${assignedTable.id}`);
                          tableElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          tableElement?.classList.add('ring-4', 'ring-[#B45309]', 'ring-offset-4');
                          setTimeout(() => {
                            tableElement?.classList.remove('ring-4', 'ring-[#B45309]', 'ring-offset-4');
                          }, 2000);
                        }
                      }}
                      className={`p-3.5 bg-white border transition-all ${
                        assignedTable 
                          ? 'border-[#F8F9FA] opacity-70 cursor-pointer hover:opacity-100 hover:border-[#B45309]/20 rounded-[1.5rem]' 
                          : 'border-slate-100 rounded-[1.5rem] cursor-grab active:cursor-grabbing hover:border-[#B45309]/30 hover:shadow-[0_8px_30px_rgb(180,83,9,0.04)] shadow-sm shadow-slate-200/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black ${
                            assignedTable ? 'bg-slate-50 text-slate-400' : 'bg-[#FFF4ED] text-[#B45309]'
                          }`}>
                            {g.name[0]}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[13px] font-black text-slate-700 tracking-tight group-hover:text-[#B45309] transition-colors">{g.name}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
                                g.side === 'bride' ? 'bg-pink-50 text-pink-500' :
                                g.side === 'groom' ? 'bg-blue-50 text-blue-500' :
                                'bg-slate-50 text-slate-500'
                              }`}>
                                {g.side}
                              </span>
                              {assignedTable && (
                                <span className="text-[#B45309]/60 text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[10px]">table_bar</span>
                                  {assignedTable.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className={`material-symbols-outlined transition-colors ${
                          assignedTable ? 'text-[#B45309] opacity-40 group-hover:opacity-100' : 'text-slate-200 group-hover:text-[#B45309]/40'
                        }`}>
                          {assignedTable ? 'location_on' : 'drag_indicator'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Tables Canvas Area */}
        <div className="col-span-12 lg:col-span-8 flex flex-col">
          <div className="relative flex-1 bg-white/60 backdrop-blur-xl rounded-[3rem] border border-white shadow-2xl p-10 overflow-y-auto h-[calc(100vh-12rem)] overflow-hidden">
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
                      id={`table-${table.id}`}
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
                          onClick={(e) => { e.stopPropagation(); handleDeleteTable(table); }}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-2 hover:bg-red-50 rounded-xl"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>

                      {/* Visual Table Representation */}
                      <div className="relative w-72 h-72 mx-auto mb-10 flex items-center justify-center translate-y-2">
                        {table.shape === 'round' ? (
                          <>
                            {/* Round Table UI */}
                            <svg className="absolute inset-0 w-full h-full -rotate-90">
                              <circle
                                cx="50%"
                                cy="50%"
                                r="46%"
                                fill="none"
                                stroke="#f8fafc"
                                strokeWidth="4"
                              />
                              <circle
                                cx="50%"
                                cy="50%"
                                r="46%"
                                fill="none"
                                stroke="#B45309"
                                strokeWidth="4"
                                strokeDasharray="415"
                                strokeDashoffset={415 - (415 * fillPercentage) / 100}
                                className="transition-all duration-1000 ease-out"
                              />
                            </svg>
                            <div className="w-40 h-40 rounded-full bg-white shadow-[0_15px_40px_rgba(0,0,0,0.06)] flex items-center justify-center border border-slate-50 relative z-10 transition-transform duration-500 hover:scale-105">
                              <span className="material-symbols-outlined text-slate-100 text-5xl">restaurant</span>
                            </div>
                            
                            {/* Seats Around Round Table */}
                            {Array.from({ length: table.capacity }).map((_, i) => {
                              const angle = (i * 360) / table.capacity;
                              // Increased radius for more spacing
                              const radius = 122;
                              const x = Math.cos((angle * Math.PI) / 180) * radius;
                              const y = Math.sin((angle * Math.PI) / 180) * radius;
                              const guest = table.assigned_guests?.[i];
                              
                              return (
                                <div 
                                  key={i}
                                  className={`absolute w-14 h-14 rounded-full border-[4px] transition-all duration-700 z-30 flex items-center justify-center group/seat shadow-[0_8px_25px_rgba(0,0,0,0.05)] ${
                                    guest 
                                      ? "bg-white border-[#B45309] text-[#B45309] scale-110" 
                                      : "bg-slate-50/80 backdrop-blur-sm border-slate-100/50 text-slate-200 scale-[0.85] hover:scale-100 hover:bg-white hover:border-[#B45309]/20"
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
      {/* Delete Table Modal */}
      {isDeletingTable && tableToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setIsDeletingTable(false)}>
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl border border-white flex flex-col items-center text-center animate-in zoom-in-95 duration-300"
          >
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mb-8 text-red-500 rotate-3">
              <span className="material-symbols-outlined text-4xl">delete_forever</span>
            </div>
            
            <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Delete Table?</h3>
            <p className="text-slate-500 font-medium text-base mb-8 px-2 leading-relaxed">
              Are you sure you want to delete <span className="text-slate-900 font-black">"{tableToDelete.name}"</span>? 
              This action cannot be undone and all guest assignments will be lost.
            </p>
            
            <div className="flex flex-col w-full gap-3">
              <button 
                onClick={confirmDeleteTable}
                className="w-full py-4 bg-red-500 text-white rounded-2xl font-black hover:bg-red-600 hover:shadow-xl hover:shadow-red-500/20 transition-all active:scale-[0.98]"
              >
                Delete Table
              </button>
              <button 
                onClick={() => setIsDeletingTable(false)}
                className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl font-black hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-[0.98]"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
