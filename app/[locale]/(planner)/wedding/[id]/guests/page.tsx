"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import type { Wedding, Guest, WeddingFunction, RSVP } from "@/lib/types";
import { generateWhatsAppLink, generateWhatsAppMessage, normalizePhone } from "@/lib/whatsapp";
import { generateEmailLink } from "@/lib/email";
import { toast } from "sonner";

export default function GuestListPage() {
  const params = useParams();
  const weddingId = params.id as string;

  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestGroups, setGuestGroups] = useState<{ id: string; name: string }[]>([]);
  const [functions, setFunctions] = useState<WeddingFunction[]>([]);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Add guest form
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newSide, setNewSide] = useState<"bride" | "groom" | "both">("both");
  const [newTags, setNewTags] = useState("");

  // Edit guest form
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSide, setEditSide] = useState<"bride" | "groom" | "both">("both");
  const [editTags, setEditTags] = useState("");

  const fetchData = useCallback(async () => {
    const [weddingRes, guestRes, groupRes, funcRes, rsvpRes] = await Promise.all([
      supabase.from("weddings").select("*").eq("id", weddingId).single(),
      supabase.from("guests").select("*").eq("wedding_id", weddingId),
      supabase.from("guest_groups").select("*").eq("wedding_id", weddingId),
      supabase.from("wedding_functions").select("*").eq("wedding_id", weddingId).order("sort_order"),
      supabase.from("rsvps").select("*").eq("wedding_id", weddingId),
    ]);
    if (weddingRes.data) setWedding(weddingRes.data);
    if (guestRes.data) setGuests(guestRes.data);
    if (groupRes.data) setGuestGroups(groupRes.data);
    if (funcRes.data) setFunctions(funcRes.data);
    if (rsvpRes.data) setRsvps(rsvpRes.data);
    setLoading(false);
  }, [weddingId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtering
  const filteredGuests = guests.filter((g) => {
    const matchSearch = searchQuery
      ? g.name.toLowerCase().includes(searchQuery.toLowerCase()) || g.phone.includes(searchQuery) || g.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    const matchStatus = statusFilter === "all" || g.overall_status === statusFilter;
    const matchTab = activeTab === "all" || g.function_ids.includes(activeTab);
    return matchSearch && matchStatus && matchTab;
  });

  const totalPages = Math.ceil(filteredGuests.length / pageSize);
  const paginatedGuests = filteredGuests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, activeTab]);

  // Collapsed family groups state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  function toggleGroupCollapse(groupId: string) {
    const next = new Set(collapsedGroups);
    next.has(groupId) ? next.delete(groupId) : next.add(groupId);
    setCollapsedGroups(next);
  }

  // Selection
  function toggleSelect(id: string) {
    const newSet = new Set(selectedIds);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setSelectedIds(newSet);
  }
  function toggleSelectAll() {
    if (selectedIds.size === filteredGuests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredGuests.map((g) => g.id)));
    }
  }

  // Add Guest
  async function handleAddGuest() {
    if (!newName || !newPhone) { toast.error("Name and phone required"); return; }
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const funcIds = functions.map((f) => f.id);
    const { data: newGuest, error } = await supabase.from("guests").insert({
      wedding_id: weddingId, name: newName, phone: newPhone, email: newEmail, side: newSide,
      tags: newTags.split(",").map((t) => t.trim()).filter(Boolean),
      function_ids: funcIds, invite_token: token,
      overall_status: "pending", imported_via: "manual",
    }).select().single();
    if (error || !newGuest) { toast.error("Failed to add guest"); return; }
    // Create invite_token with actual guest ID
    await supabase.from("invite_tokens").insert({
      token, wedding_id: weddingId, guest_id: newGuest.id,
      function_ids: funcIds, used: false,
    });
    toast.success("✅ Guest added!");
    setShowAddDialog(false);
    setNewName(""); setNewPhone(""); setNewEmail(""); setNewTags("");
    fetchData();
  }

  // Edit Guest
  function openEditDialog(guest: Guest) {
    setEditingGuest(guest);
    setEditName(guest.name);
    setEditPhone(guest.phone);
    setEditEmail(guest.email || "");
    setEditSide(guest.side);
    setEditTags(guest.tags.join(", "));
  }

  async function handleUpdateGuest() {
    if (!editingGuest || !editName || !editPhone) {
      toast.error("Name and phone required");
      return;
    }
    const { error } = await supabase.from("guests").update({
      name: editName,
      phone: editPhone,
      email: editEmail,
      side: editSide,
      tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
    }).eq("id", editingGuest.id);

    if (error) { toast.error("Failed to update guest"); return; }
    
    toast.success("Guest updated successfully");
    setEditingGuest(null);
    fetchData();
  }

  // Delete Guest
  async function handleDelete(id: string) {
    await supabase.from("guests").delete().eq("id", id);
    toast.success("Guest removed");
    fetchData();
  }
  
  // Grouping Actions
  async function handleCreateGroup() {
    // Guard: prevent adding a guest who already belongs to a DIFFERENT group
    const alreadyInGroup = guests.filter(
      (g) => selectedIds.has(g.id) && g.group_id !== null
    );
    if (alreadyInGroup.length > 0) {
      const names = alreadyInGroup.map((g) => g.name).join(", ");
      toast.error(
        `Cannot group: ${names} already belong to a family. Remove them from their current family first.`,
        { duration: 5000 }
      );
      return;
    }

    const groupName = prompt("Enter Family/Group Name (e.g. The Sharma Family):");
    if (!groupName) return;

    const { data: group, error: groupError } = await supabase
      .from("guest_groups")
      .insert({ wedding_id: weddingId, name: groupName })
      .select()
      .single();

    if (groupError || !group) {
      toast.error("Failed to create group");
      return;
    }

    const { error: updateError } = await supabase
      .from("guests")
      .update({ group_id: group.id })
      .in("id", Array.from(selectedIds));

    if (updateError) {
      toast.error("Failed to assign guests to group");
    } else {
      toast.success(`✅ Family "${groupName}" created with ${selectedIds.size} members!`);
      setSelectedIds(new Set());
      fetchData();
    }
  }

  async function handleRemoveFromGroup(guestId: string) {
    const { error } = await supabase
      .from("guests")
      .update({ group_id: null })
      .eq("id", guestId);
    
    if (error) toast.error("Failed to remove from group");
    else {
      toast.success("Guest removed from group");
      fetchData();
    }
  }

  // Import Guests (CSV/Excel)
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet) as any[];

      const funcIds = functions.map((f) => f.id);
      let count = 0;

      for (const row of data) {
        // Handle various header variations
        const name = row.Name || row.name || row.Guest || row.guest;
        const phone = row.Phone || row.phone || row.Mobile || row.mobile || row.Number || row.number;
        const email = row.Email || row.email || row.Mail || row.mail;
        const sideStr = String(row.Side || row.side || "both").toLowerCase().trim();
        const tagsStr = row.Tags || row.tags || "";

        if (!name || !phone) continue;

        // DB constraints check
        const allowedSides = ["bride", "groom", "both"];
        const side = allowedSides.includes(sideStr) ? sideStr : "both";

        const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const { data: newGuest, error: guestError } = await supabase.from("guests").insert({
          wedding_id: weddingId,
          name: String(name).trim(),
          phone: String(phone).trim(),
          email: email ? String(email).trim() : null,
          side: side as "bride" | "groom" | "both",
          tags: tagsStr ? String(tagsStr).split(/[;,]/).map((t: string) => t.trim()).filter(Boolean) : [],
          function_ids: funcIds,
          invite_token: token,
          overall_status: "pending",
          imported_via: file.name.endsWith(".csv") ? "csv" : "excel",
        }).select().single();

        if (guestError) {
          console.error("Supabase insert error:", guestError);
          continue;
        }

        if (newGuest) {
          const { error: tokenError } = await supabase.from("invite_tokens").insert({
            token,
            wedding_id: weddingId,
            guest_id: newGuest.id,
            function_ids: funcIds,
            used: false,
          });
          if (tokenError) console.error("Token insert error:", tokenError);
          count++;
        }
      }

      toast.success(`📥 Imported ${count} guests from ${file.name}`);
      fetchData();
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import file. Please check the format.");
    } finally {
      if (csvRef.current) csvRef.current.value = "";
    }
  }

  function getInitials(name: string) {
    return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  }

  const statusColors: Record<string, { bg: string; dot: string; text: string }> = {
    confirmed: { bg: "bg-green-100", dot: "bg-green-500", text: "text-green-700" },
    pending: { bg: "bg-amber-100", dot: "bg-amber-500", text: "text-amber-700" },
    declined: { bg: "bg-red-100", dot: "bg-red-500", text: "text-red-700" },
    partial: { bg: "bg-blue-100", dot: "bg-blue-500", text: "text-blue-700" },
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-white rounded-xl animate-pulse border border-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-32">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Guest List</h2>
          <p className="text-slate-500 font-medium">
            {wedding?.wedding_name} · <span className="text-primary">{guests.length} guests</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => csvRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 border-2 border-slate-200 text-slate-700 rounded-lg font-bold text-sm hover:bg-white transition-all"
          >
            <span className="material-symbols-outlined text-xl">upload_file</span>
            Import List
          </button>
          <input 
            ref={csvRef} 
            type="file" 
            accept=".csv, .xlsx, .xls" 
            className="hidden" 
            onChange={handleImport} 
          />
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:shadow-lg hover:shadow-primary/20 transition-all"
          >
            <span className="material-symbols-outlined text-xl">person_add</span>
            Add Guest
          </button>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 flex px-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-6 py-4 text-sm font-bold whitespace-nowrap border-b-2 ${
              activeTab === "all" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            All Guests
          </button>
          {functions.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveTab(f.id)}
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 ${
                activeTab === f.id ? "border-primary text-primary font-bold" : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>

        <div className="p-4 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm transition-all"
                placeholder="Search by name, phone or tag..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <span className="text-sm font-semibold text-slate-500">Filter by:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium py-2 pl-4 pr-10"
            >
              <option value="all">Status: All</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="declined">Declined</option>
            </select>
          </div>
        </div>
      </div>

      {/* Guest Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/50 border-b border-slate-200">
            <tr>
              <th className="py-4 px-6 w-12">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredGuests.length && filteredGuests.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 text-primary focus:ring-primary"
                />
              </th>
              <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Guest Name</th>
              <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Functions</th>
              <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Tags</th>
              <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(() => {
              // Build a grouped render: family sections first, then ungrouped
              const rows: React.ReactNode[] = [];

              // Group the PAGINATED guests by group_id
              const grouped = new Map<string, Guest[]>();
              const ungrouped: Guest[] = [];

              for (const g of paginatedGuests) {
                if (g.group_id) {
                  if (!grouped.has(g.group_id)) grouped.set(g.group_id, []);
                  grouped.get(g.group_id)!.push(g);
                } else {
                  ungrouped.push(g);
                }
              }

              // Helper: render a single guest row
              function GuestRow({ guest, indent }: { guest: Guest; indent?: boolean }) {
                const status = statusColors[guest.overall_status] || statusColors.pending;
                return (
                  <tr key={guest.id} className={`hover:bg-slate-50/80 transition-colors group ${indent ? "bg-slate-50/40" : ""}`}>
                    <td className="py-3.5 px-6">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(guest.id)}
                        onChange={() => toggleSelect(guest.id)}
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                      />
                    </td>
                    <td className={`py-3.5 ${indent ? "pl-10 pr-6" : "px-6"}`}>
                      <div className="flex items-center gap-2">
                        {indent && <span className="text-slate-300 text-sm">└</span>}
                        <div className="font-semibold text-slate-900 text-sm">{guest.name}</div>
                      </div>
                      <div className={`text-xs text-slate-500 ${indent ? "pl-4" : ""}`}>{guest.phone}</div>
                      {guest.email && <div className={`text-[10px] text-slate-400 ${indent ? "pl-4" : ""}`}>{guest.email}</div>}
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex gap-1.5">
                        {functions
                          .filter((f) => guest.function_ids.includes(f.id))
                          .map((f, i) => {
                            const colors = ["bg-blue-100 text-blue-700", "bg-orange-100 text-orange-700", "bg-purple-100 text-purple-700", "bg-pink-100 text-pink-700"];
                            return (
                              <span key={f.id} className={`size-6 flex items-center justify-center rounded-full text-[10px] font-black ${colors[i % colors.length]}`} title={f.name}>
                                {f.name[0]}
                              </span>
                            );
                          })}
                      </div>
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex flex-wrap gap-2">
                        {guest.tags.map((tag) => (
                          <span key={tag} className={`px-2 py-0.5 rounded text-[10px] font-bold ${ tag.toLowerCase() === "vip" ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-600" }`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-6">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${status.bg} ${status.text}`}>
                        <span className={`size-1.5 rounded-full ${status.dot} mr-2`} />
                        {guest.overall_status.charAt(0).toUpperCase() + guest.overall_status.slice(1)}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {guest.group_id && (
                          <button onClick={() => handleRemoveFromGroup(guest.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Remove from Family">
                            <span className="material-symbols-outlined text-[18px]">group_remove</span>
                          </button>
                        )}
                        {wedding && (
                          <a href={generateWhatsAppLink(guest, wedding, functions)} target="_blank" rel="noopener" className="p-1.5 text-slate-400 hover:text-[#25D366] transition-colors" title="WhatsApp">
                            <span className="material-symbols-outlined text-[18px]">chat</span>
                          </a>
                        )}
                        {wedding && guest.email && (
                          <a href={generateEmailLink(guest, wedding, functions)} className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors" title="Email">
                            <span className="material-symbols-outlined text-[18px]">mail</span>
                          </a>
                        )}
                        <button onClick={() => openEditDialog(guest)} className="p-1.5 text-slate-400 hover:text-primary transition-colors" title="Edit">
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button onClick={() => handleDelete(guest.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              // Render family group sections
              for (const [groupId, members] of grouped.entries()) {
                const group = guestGroups.find((g) => g.id === groupId);
                const isCollapsed = collapsedGroups.has(groupId);
                rows.push(
                  <tr key={`group-header-${groupId}`} className="bg-primary/5 border-b border-primary/10">
                    <td className="py-3 px-6">
                      <input
                        type="checkbox"
                        checked={members.every((m) => selectedIds.has(m.id))}
                        onChange={() => {
                          const next = new Set(selectedIds);
                          const allSelected = members.every((m) => selectedIds.has(m.id));
                          members.forEach((m) => allSelected ? next.delete(m.id) : next.add(m.id));
                          setSelectedIds(next);
                        }}
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="py-3 px-6" colSpan={5}>
                      <button
                        onClick={() => toggleGroupCollapse(groupId)}
                        className="flex items-center gap-2 w-full text-left"
                      >
                        <span className="material-symbols-outlined text-primary text-[18px]">
                          {isCollapsed ? "chevron_right" : "expand_more"}
                        </span>
                        <span className="material-symbols-outlined text-primary text-[16px]">family_restroom</span>
                        <span className="font-bold text-primary text-sm">{group?.name || "Unknown Family"}</span>
                        <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary text-[11px] font-bold rounded-full">
                          {members.length} {members.length === 1 ? "member" : "members"}
                        </span>
                      </button>
                    </td>
                  </tr>
                );
                if (!isCollapsed) {
                  members.forEach((guest) => rows.push(<GuestRow key={guest.id} guest={guest} indent />));
                }
              }

              // Render ungrouped guests normally
              ungrouped.forEach((guest) => rows.push(<GuestRow key={guest.id} guest={guest} />));

              return rows;
            })()}
          </tbody>
        </table>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredGuests.length)} of {filteredGuests.length} guests
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-white border border-slate-200 rounded text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 bg-white border border-slate-200 rounded text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl shadow-slate-900/40 flex items-center justify-between border border-white/10">
            <div className="flex items-center gap-4 pl-2">
              <div className="bg-primary size-8 rounded-full flex items-center justify-center font-black text-sm">
                {selectedIds.size}
              </div>
              <div>
                <p className="text-sm font-bold">{selectedIds.size} guests selected</p>
                <p className="text-[10px] text-slate-400 font-medium">Ready for bulk actions</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCreateGroup}
                className="px-5 py-2 hover:bg-white/10 text-white rounded-lg font-bold text-sm flex items-center gap-2 transition-all"
              >
                <span className="material-symbols-outlined text-xl">group_add</span>
                Group Together
              </button>
              <button
                onClick={async () => {
                  if (!wedding) return;
                  const selectedGuests = guests.filter((g) => selectedIds.has(g.id));
                  // Export for extension
                  const payload = selectedGuests.map(g => ({
                    phone: normalizePhone(g.phone).replace('+', ''),
                    message: generateWhatsAppMessage(g, wedding, functions)
                  }));
                  
                  await navigator.clipboard.writeText(JSON.stringify(payload));
                  
                  // Mark all as sent
                  await supabase
                    .from("guests")
                    .update({ invite_sent_at: new Date().toISOString() })
                    .in("id", Array.from(selectedIds));
                    
                  toast.success(`📋 Copied ${selectedGuests.length} invites to clipboard! Open the WedSync Extension on WhatsApp Web.`);
                  setSelectedIds(new Set());
                  fetchData();
                }}
                className="px-5 py-2 bg-primary text-white rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/20"
              >
                <span className="material-symbols-outlined text-xl">extension</span>
                Export for Extension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Guest Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddDialog(false)}>
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black text-slate-900 mb-6">Add Guest</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Name</label>
                <input
                  className="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary focus:border-primary"
                  value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="Guest full name"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</label>
                <input
                  className="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary focus:border-primary"
                  value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                <input
                  className="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary focus:border-primary"
                  value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="guest@example.com"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Side</label>
                <select
                  className="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary focus:border-primary"
                  value={newSide} onChange={(e) => setNewSide(e.target.value as "bride" | "groom" | "both")}
                >
                  <option value="both">Both</option>
                  <option value="bride">Bride Side</option>
                  <option value="groom">Groom Side</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tags (comma separated)</label>
                <input
                  className="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary focus:border-primary"
                  value={newTags} onChange={(e) => setNewTags(e.target.value)}
                  placeholder="Family, VIP"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddDialog(false)}
                className="flex-1 py-2.5 border-2 border-slate-200 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddGuest}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg font-bold text-sm hover:bg-primary/90 shadow-md shadow-primary/20"
              >
                Add Guest
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Guest Dialog */}
      {editingGuest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditingGuest(null)}>
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900">Edit Guest</h3>
              <button onClick={() => setEditingGuest(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Name</label>
                <input
                  className="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary focus:border-primary"
                  value={editName} onChange={(e) => setEditName(e.target.value)}
                  placeholder="Guest full name"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</label>
                <input
                  className="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary focus:border-primary"
                  value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                <input
                  className="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary focus:border-primary"
                  value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="guest@example.com"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Side</label>
                <select
                  className="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary focus:border-primary"
                  value={editSide} onChange={(e) => setEditSide(e.target.value as "bride" | "groom" | "both")}
                >
                  <option value="both">Both</option>
                  <option value="bride">Bride Side</option>
                  <option value="groom">Groom Side</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tags (comma separated)</label>
                <input
                  className="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary focus:border-primary"
                  value={editTags} onChange={(e) => setEditTags(e.target.value)}
                  placeholder="Family, VIP"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingGuest(null)}
                className="flex-1 py-2.5 border-2 border-slate-200 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateGuest}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg font-bold text-sm hover:bg-primary/90 shadow-md shadow-primary/20"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
