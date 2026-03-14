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

  const unassignedGuests = guests.filter(g => 
    g.function_ids.includes(selectedFunctionId) &&
    !tables.some(t => t.assigned_guests?.some(ag => ag.id === g.id))
  );

  async function handleAddTable() {
    const tableName = prompt("Enter Table Name (e.g. Table 1, VIP A):");
    if (!tableName) return;

    const { error } = await supabase.from("seating_tables").insert({
      wedding_id: weddingId,
      function_id: selectedFunctionId,
      name: tableName,
      capacity: 10
    });

    if (error) toast.error("Failed to add table");
    else {
      toast.success("Table added!");
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
    <div className="space-y-8 pb-32">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Seating Plan</h2>
          <p className="text-slate-500 font-medium">Assign confirmed guests to tables for each function</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Select Event</span>
            <select
              value={selectedFunctionId}
              onChange={(e) => setSelectedFunctionId(e.target.value)}
              className="bg-white border-2 border-slate-200 rounded-lg px-4 py-2 font-bold text-slate-700 outline-none focus:border-primary transition-all"
            >
              {functions.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAddTable}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Add Table
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Guest Sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden sticky top-8">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Unassigned Guests</h3>
              <span className="bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                {unassignedGuests.length} Remaining
              </span>
            </div>
            <div className="max-height-[calc(100vh-250px)] overflow-y-auto p-4 space-y-2">
              {unassignedGuests.length === 0 ? (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-slate-200 text-5xl mb-2">task_alt</span>
                  <p className="text-slate-400 text-sm font-medium">All guests assigned!</p>
                </div>
              ) : (
                unassignedGuests.map(g => (
                  <div 
                    key={g.id} 
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("guestId", g.id)}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between group cursor-grab active:cursor-grabbing hover:border-primary hover:bg-primary/5 transition-all shadow-sm"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{g.name}</div>
                      <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{g.side} Side</div>
                    </div>
                    <div className="flex gap-2">
                      {tables.length > 0 && (
                        <select
                          onChange={(e) => handleAssignGuest(g.id, e.target.value)}
                          className="text-[10px] font-bold bg-white border border-slate-300 rounded px-1 outline-none opacity-0 group-hover:opacity-100 transition-opacity"
                          value=""
                        >
                          <option value="">Move to...</option>
                          {tables.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Tables Grid */}
        <div className="col-span-12 lg:col-span-8">
          {tables.length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center">
              <span className="material-symbols-outlined text-slate-300 text-6xl mb-4">table_restaurant</span>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No tables created yet</h3>
              <p className="text-slate-500 mb-6 font-medium">Create tables to start organizing your guest seating layout.</p>
              <button
                onClick={handleAddTable}
                className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-900 rounded-xl font-bold hover:border-primary transition-all"
              >
                Create Your First Table
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tables.map(table => (
                <div
                  key={table.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const guestId = e.dataTransfer.getData("guestId");
                    handleAssignGuest(guestId, table.id);
                  }}
                  className={`bg-white rounded-2xl border-2 transition-all p-6 group ${
                    activeTableId === table.id ? "border-primary shadow-xl shadow-primary/10 scale-[1.02]" : "border-slate-100 hover:border-slate-200 shadow-sm"
                  }`}
                  onClick={() => setActiveTableId(table.id)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">{table.name}</h4>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          (table.assigned_guests?.length || 0) >= table.capacity ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                        }`}>
                          {table.assigned_guests?.length || 0} / {table.capacity} Seated
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id); }}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-1"
                    >
                      <span className="material-symbols-outlined text-xl">delete</span>
                    </button>
                  </div>

                  <div className="space-y-2 mt-4 min-h-[50px] border-t border-slate-50 pt-4">
                    {table.assigned_guests && table.assigned_guests.length > 0 ? (
                      table.assigned_guests.map(guest => (
                        <div key={guest.id} className="flex justify-between items-center group/member p-2 hover:bg-slate-50 rounded-lg">
                          <span className="text-sm font-medium text-slate-700">{guest.name}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUnassignGuest(guest.id, table.id); }}
                            className="opacity-0 group-hover/member:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">remove_circle</span>
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-slate-300 font-bold uppercase text-center mt-4">Drop Guests Here</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
