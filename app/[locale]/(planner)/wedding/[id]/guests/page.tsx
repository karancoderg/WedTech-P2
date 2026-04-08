"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import type { Wedding, Guest, WeddingFunction, RSVP } from "@/lib/types";

import { toast } from "sonner";
import { encryptValue } from "@/lib/client-encryption"; // still used by add/edit guest

// TODO: `deriveFunctionsForSide` is duplicated here (for add/edit guest) and in
// app/api/wedding/[id]/import-guests/route.ts (for batch import, server-side).
// Consolidate into lib/guest-utils.ts when the import flow no longer needs
// the client copy (i.e., after all import work moves fully server-side).
function deriveFunctionsForSide(side: 'bride' | 'groom' | 'both', allFunctions: WeddingFunction[]) {
  if (side === 'both') return allFunctions.map(f => f.id);

  return allFunctions.filter(f => {
    const name = f.name.toLowerCase();

    // Joint events always included for everyone
    const isJoint = name.includes('joint') || name.includes('combined');
    if (isJoint) return true;

    if (side === 'bride') {
      return !name.includes('groom') &&
             !name.includes('baraat') &&
             !name.includes('sehrabandi');
    } else {
      return !name.includes('bride') &&
             !(name.includes('mehendi') && !name.includes('joint')) &&
             !name.includes('chooda') &&
             !name.includes('bhaat');
    }
  }).map(f => f.id);
}

function generateInviteToken() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }
  // Fallback for non-secure contexts
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
}

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
  // true = user explicitly chose "Select all N matching guests" (all filtered, not just page)
  const [selectAllFiltered, setSelectAllFiltered] = useState(false);
  const [showBulkEmailDialog, setShowBulkEmailDialog] = useState(false);
  const [guestsWithEmail, setGuestsWithEmail] = useState<Guest[]>([]);
  const [guestsWithInvalidEmail, setGuestsWithInvalidEmail] = useState<Guest[]>([]);
  const [guestsWithoutEmail, setGuestsWithoutEmail] = useState<Guest[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [groupName, setGroupName] = useState("");
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
    const [weddingRes, guestData, groupRes, funcRes, rsvpRes] = await Promise.all([
      supabase.from("weddings").select("*").eq("id", weddingId).single(),
      fetch(`/api/wedding/${weddingId}/guests`).then(res => {
        if (!res.ok) { console.error("Failed to fetch guests:", res.status); return []; }
        return res.json().catch(() => []);
      }),
      supabase.from("guest_groups").select("*").eq("wedding_id", weddingId),
      supabase.from("wedding_functions").select("*").eq("wedding_id", weddingId).order("sort_order"),
      supabase.from("rsvps").select("*").eq("wedding_id", weddingId),
    ]);
    if (weddingRes.data) setWedding(weddingRes.data);
    
    // Guest data is already decrypted server-side
    if (guestData) setGuests(guestData);
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
    setSelectAllFiltered(false); // individual toggle exits select-all-filtered mode
    setSelectedIds(newSet);
  }

  // Selects / deselects the CURRENT PAGE only (not all filtered guests).
  // If you want to act on all filtered guests, use the banner link below the table header.
  function toggleSelectAll() {
    const pageIds = new Set(paginatedGuests.map((g) => g.id));
    const allPageSelected = paginatedGuests.every((g) => selectedIds.has(g.id));
    if (allPageSelected) {
      // Deselect page — also exit select-all-filtered mode
      const next = new Set(selectedIds);
      pageIds.forEach((id) => next.delete(id));
      setSelectedIds(next);
      setSelectAllFiltered(false);
    } else {
      // Select all on current page
      const next = new Set(selectedIds);
      pageIds.forEach((id) => next.add(id));
      setSelectedIds(next);
    }
  }

  // Selects ALL filtered guests across all pages (triggered by banner link).
  function selectAllFilteredGuests() {
    setSelectedIds(new Set(filteredGuests.map((g) => g.id)));
    setSelectAllFiltered(true);
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setSelectAllFiltered(false);
  }

  // Add Guest
  async function handleAddGuest() {
    if (!newName || !newPhone) { toast.error("Name and phone required"); return; }
    const token = generateInviteToken();
    const funcIds = deriveFunctionsForSide(newSide, functions);
    const { data: newGuest, error } = await supabase.from("guests").insert({
      wedding_id: weddingId, 
      name: newName, 
      phone: await encryptValue(newPhone), 
      email: newEmail ? await encryptValue(newEmail) : null, 
      side: newSide,
      tags: newTags.split(",").map((t) => t.trim()).filter(Boolean),
      function_ids: funcIds, 
      invite_token: token,
      overall_status: "pending", 
      imported_via: "manual",
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
      phone: await encryptValue(editPhone),
      email: editEmail ? await encryptValue(editEmail) : null,
      side: editSide,
      tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
    }).eq("id", editingGuest.id);

    if (error) { toast.error("Failed to update guest"); return; }
    
    toast.success("Guest updated successfully");
    setEditingGuest(null);
    fetchData();
  }

  // Single-guest delete state
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function confirmDeleteGuest(id: string) {
    setPendingDeleteId(id);
    setShowDeleteConfirm(true);
  }

  // Delete Guest — routes through server-side API so CASCADE + counter recalc happen
  async function handleDelete() {
    if (!pendingDeleteId) return;
    setShowDeleteConfirm(false);
    const toastId = toast.loading("Removing guest...");
    try {
      const res = await fetch(`/api/wedding/${weddingId}/delete-guests`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestIds: [pendingDeleteId] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || "Delete failed");
      }
      toast.success("Guest removed", { id: toastId });
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Failed to remove guest", { id: toastId });
    } finally {
      setPendingDeleteId(null);
    }
  }
  
  // Grouping Actions
  async function handlePreCreateGroup() {
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

    setShowGroupDialog(true);
  }

  async function handleCreateGroup() {
    if (!groupName.trim()) return;

    const { data: group, error: groupError } = await supabase
      .from("guest_groups")
      .insert({ wedding_id: weddingId, name: groupName.trim() })
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
      setGroupName("");
      setShowGroupDialog(false);
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

  // Bulk Deletion — server-side API handles CASCADE cleanup + counter recalc
  async function handleBulkDelete() {
    setShowDeleteConfirm(false);
    const count = selectedIds.size;
    const toastId = toast.loading(`Removing ${count} guests...`);

    try {
      const res = await fetch(`/api/wedding/${weddingId}/delete-guests`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestIds: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || "Delete failed");
      }
      const result = await res.json();
      toast.success(`✅ Removed ${result.deleted ?? count} guests`, { id: toastId });
      clearSelection();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete guests", { id: toastId });
    }
  }

  // AI Calling
  const [callingGuests, setCallingGuests] = useState(false);
  async function handleAICall(targetGuestIds?: string[]) {
    const idsToCall = targetGuestIds || Array.from(selectedIds);
    if (idsToCall.length === 0) return;
    
    setCallingGuests(true);
    const toastId = toast.loading(`Initiating AI call${idsToCall.length > 1 ? 's' : ''} to ${idsToCall.length} guest${idsToCall.length > 1 ? 's' : ''}...`);
    
    try {
      const response = await fetch(`/api/wedding/${weddingId}/ai-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestIds: idsToCall }),
      });
      
      let result;
      try {
        result = await response.json();
      } catch (e) {
        if (!response.ok) throw new Error("Server communication failed.");
      }
      
      if (response.ok && result?.success) {
        toast.success(`🤖 Initiated ${result.successful} AI calls! ${result.failed > 0 ? `${result.failed} failed.` : ""}`, {
          id: toastId,
        });
        if (!targetGuestIds) setSelectedIds(new Set());
        fetchData();
      } else {
        toast.error(`Error: ${result?.error || "Failed to trigger calls"}`, { id: toastId });
      }
    } catch (error: any) {
      console.error("AI Call Error:", error);
      if (typeof window !== "undefined" && !navigator.onLine || error?.message?.includes("Failed to fetch") || error?.message?.includes("Load failed") || error?.message?.includes("NetworkError")) {
        toast.error("No internet connection. Please check your network.", { id: toastId });
      } else {
        toast.error(error?.message || "An error occurred while initiating calls", { id: toastId });
      }
    } finally {
      setCallingGuests(false);
    }
  }

  // Bulk Email Actions
  const [sendingEmails, setSendingEmails] = useState(false);
  async function handleBulkEmail() {
    if (selectedIds.size === 0) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allowedDomains = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com', 'yahoo.co.in'];
    const commonTypos = [
      'yaaho.com', 'yaho.com', 'gmal.com', 'gamil.com', 'gmial.com', 
      'hotmial.com', 'hotamail.com', 'outlok.com', 'outllok.com', 'hotlook.com'
    ];
    const selectedGuests = guests.filter(g => selectedIds.has(g.id));
    
    const withEmail = selectedGuests.filter(g => {
      if (!g.email) return false;
      const domain = g.email.toLowerCase().split('@')[1];
      return emailRegex.test(g.email) && allowedDomains.includes(domain);
    });

    const withInvalidEmail = selectedGuests.filter(g => {
      if (!g.email) return false;
      const domain = g.email.toLowerCase().split('@')[1];
      return !emailRegex.test(g.email) || !allowedDomains.includes(domain) || commonTypos.includes(domain);
    });

    const withoutEmail = selectedGuests.filter(g => !g.email);

    if (withEmail.length === 0 && withInvalidEmail.length === 0) {
      toast.error("None of the selected guests have email addresses.");
      return;
    }

    setGuestsWithEmail(withEmail);
    setGuestsWithInvalidEmail(withInvalidEmail);
    setGuestsWithoutEmail(withoutEmail);
    setShowBulkEmailDialog(true);
  }

  async function confirmSendEmails() {
    setShowBulkEmailDialog(false);
    setSendingEmails(true);
    const toastId = toast.loading(`Sending emails to ${guestsWithEmail.length} guests...`);
    
    try {
      const response = await fetch(`/api/wedding/${weddingId}/send-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestIds: guestsWithEmail.map(g => g.id) }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Failed to send emails");

      toast.success(`✉️ Sent ${result.successful} emails! ${result.failed > 0 ? `${result.failed} failed.` : ""}`, {
        id: toastId,
      });
      
      setSelectedIds(new Set());
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "An error occurred while sending emails", {
        id: toastId,
      });
    } finally {
      setSendingEmails(false);
    }
  }

  // Import Guests (CSV/Excel) — batch mode
  // All encryption + DB writes happen server-side in /api/wedding/[id]/import-guests
  // so this function only parses the file and chunks the rows.
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // ── 1. Parse file client-side (must stay in browser) ──────────────────
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (rawData.length === 0) {
        toast.error("The file appears to be empty.");
        return;
      }

      // ── 2. Normalise column names ──────────────────────────────────────────
      const rows = rawData.map((row) => {
        const name  = row.Name  || row.name  || row.Guest  || row.guest  || "";
        const phone = row.Phone || row.phone || row.Mobile || row.mobile || row.Number || row.number || "";
        const email = row.Email || row.email || row.Mail   || row.mail   || "";
        const side  = String(row.Side || row.side || "both");
        const tagsStr = row.Tags || row.tags || "";
        const tags  = tagsStr
          ? String(tagsStr).split(/[;,]/).map((t: string) => t.trim()).filter(Boolean)
          : [];
        return { name: String(name).trim(), phone: String(phone).trim(), email: email ? String(email).trim() : "", side, tags };
      }).filter((r) => r.name && r.phone);

      if (rows.length === 0) {
        toast.error("No valid rows found. Make sure the file has Name and Phone columns.");
        return;
      }

      // ── 3. Chunked batch POST — 250 rows per request ───────────────────────
      const CHUNK_SIZE = 250;
      const chunks: typeof rows[] = [];
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        chunks.push(rows.slice(i, i + CHUNK_SIZE));
      }

      let totalImported = 0;
      let totalFailed   = 0;
      const allInvalid: { index: number; name: string; reason: string }[] = [];
      const toastId = toast.loading(`📥 Importing guests... (0 / ${rows.length})`);

      for (let i = 0; i < chunks.length; i++) {
        const res = await fetch(`/api/wedding/${weddingId}/import-guests`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: chunks[i], fileName: file.name }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error("Import chunk error:", errData);
          totalFailed += chunks[i].length;
          toast.loading(
            `📥 Importing guests... (${totalImported} / ${rows.length}) — chunk ${i + 1} failed`,
            { id: toastId }
          );
          continue;
        }

        const result = await res.json();
        totalImported += result.imported ?? 0;
        totalFailed   += result.failed   ?? 0;

        // Collect per-row validation failures from the server
        if (Array.isArray(result.invalid) && result.invalid.length > 0) {
          allInvalid.push(...result.invalid);
          console.warn(
            `Import: ${result.invalid.length} row(s) skipped in chunk ${i + 1}:`,
            result.invalid
          );
        }

        toast.loading(
          `📥 Importing guests... (${totalImported} / ${rows.length})`,
          { id: toastId }
        );
      }

      // ── 4. Final result ────────────────────────────────────────────────────
      if (allInvalid.length > 0) {
        // Surface first few skipped names so the user knows what to fix
        const skippedNames = allInvalid
          .slice(0, 3)
          .map((r) => r.name)
          .join(", ");
        const more = allInvalid.length > 3 ? ` +${allInvalid.length - 3} more` : "";
        toast.warning(
          `📥 Imported ${totalImported} guests — ${allInvalid.length} row(s) skipped (${skippedNames}${more}). Check console for details.`,
          { id: toastId, duration: 8000 }
        );
      } else {
        toast.success(`📥 Imported ${totalImported} guests from ${file.name}`, { id: toastId });
      }

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

  const sideColors: Record<string, { bg: string; text: string }> = {
    bride: { bg: "bg-pink-50 border-pink-200", text: "text-pink-600" },
    groom: { bg: "bg-blue-50 border-blue-200", text: "text-blue-600" },
    both: { bg: "bg-purple-50 border-purple-200", text: "text-purple-600" },
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
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Guest List</h2>
          <p className="text-sm md:text-base text-slate-500 font-medium">
            {wedding?.wedding_name} · <span className="text-primary">{guests.length} guests</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
          <button
            onClick={() => csvRef.current?.click()}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 border-2 border-slate-200 text-slate-700 rounded-lg font-bold text-sm hover:bg-white transition-all"
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
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:shadow-lg hover:shadow-primary/20 transition-all"
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

        <div className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="w-full md:flex-1">
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
          <div className="flex w-full md:w-auto gap-3 items-center min-w-0">
            <span className="text-sm font-semibold text-slate-500 whitespace-nowrap">Filter by:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 md:flex-none max-w-full bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium py-2 pl-4 pr-10 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              <option value="all">Status: All</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="declined">Declined</option>
            </select>
          </div>
        </div>
      </div>


      {/* Guest Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/50 border-b border-slate-200">
            <tr>
              <th className="py-4 px-6 w-12">
                <input
                  type="checkbox"
                  // Checked only when every guest on the CURRENT PAGE is selected
                  checked={paginatedGuests.length > 0 && paginatedGuests.every((g) => selectedIds.has(g.id))}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 text-primary focus:ring-primary"
                />
              </th>
              <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Guest Name</th>
              <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Side</th>
              <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Functions</th>
              <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Tags</th>
              <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(() => {
              const rows: React.ReactNode[] = [];
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
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold capitalize ${sideColors[guest.side]?.bg || "bg-slate-50 border-slate-200"} ${sideColors[guest.side]?.text || "text-slate-600"}`}>
                        {guest.side}
                      </span>
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
                      {guest.invite_status && guest.invite_status !== 'none' && (
                        <div className="mt-1 flex items-center gap-1 opacity-70">
                          <span className={`material-symbols-outlined text-[12px] ${
                            guest.invite_status === 'sent' ? 'text-green-500' :
                            guest.invite_status === 'failed' ? 'text-red-500' : 'text-amber-500'
                          }`}>
                            {guest.invite_status === 'sent' ? 'mark_email_read' : 
                             guest.invite_status === 'failed' ? 'error' : 'schedule_send'}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400">
                            {guest.invite_status.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {guest.group_id && (
                          <button onClick={() => handleRemoveFromGroup(guest.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Remove from Family">
                            <span className="material-symbols-outlined text-[18px]">group_remove</span>
                          </button>
                        )}
                        <button onClick={() => openEditDialog(guest)} className="p-1.5 text-slate-400 hover:text-primary transition-colors" title="Edit">
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button onClick={() => confirmDeleteGuest(guest.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

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
                    <td className="py-3 px-6" colSpan={6}>
                      <button onClick={() => toggleGroupCollapse(groupId)} className="flex items-center gap-2 w-full text-left">
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
                if (!isCollapsed) members.forEach((guest) => rows.push(<GuestRow key={guest.id} guest={guest} indent />));
              }
              ungrouped.forEach((guest) => rows.push(<GuestRow key={guest.id} guest={guest} />));
              return rows;
            })()}
          </tbody>
        </table>

        {/* Gmail-style select-all banner — appears when entire page is selected */}
        {paginatedGuests.length > 0 && paginatedGuests.every((g) => selectedIds.has(g.id)) && (
          <div className="bg-primary/5 border-t border-primary/10 px-6 py-3 flex items-center justify-center gap-3 text-sm">
            {selectAllFiltered ? (
              <>
                <span className="font-semibold text-slate-700">
                  All <strong>{filteredGuests.length}</strong> matching guests are selected.
                </span>
                <button
                  onClick={clearSelection}
                  className="text-primary font-bold hover:underline"
                >
                  Clear selection
                </button>
              </>
            ) : (
              <>
                <span className="font-semibold text-slate-700">
                  All <strong>{paginatedGuests.length}</strong> guests on this page are selected.
                </span>
                {filteredGuests.length > paginatedGuests.length && (
                  <button
                    onClick={selectAllFilteredGuests}
                    className="text-primary font-bold hover:underline"
                  >
                    Select all {filteredGuests.length} matching guests
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Guest Mobile Cards */}
      <div className="md:hidden space-y-4">
        {(() => {
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

          function GuestCard({ guest, isFamilyMember }: { guest: Guest; isFamilyMember?: boolean }) {
            const status = statusColors[guest.overall_status] || statusColors.pending;
            return (
              <div key={guest.id} className={`bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm ${isFamilyMember ? "border-l-4 border-l-primary/20 ml-2" : ""}`}>
                <div className="p-2.5 flex flex-col gap-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(guest.id)}
                        onChange={() => toggleSelect(guest.id)}
                        className="mt-0.5 rounded border-slate-300 text-primary focus:ring-primary shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-sm truncate">{guest.name}</h4>
                          {guest.invite_status && guest.invite_status !== 'none' && (
                            <span className={`material-symbols-outlined text-[12px] ${
                              guest.invite_status === 'sent' ? 'text-green-500' :
                              guest.invite_status === 'failed' ? 'text-red-500' : 'text-amber-500'
                            }`} title={`Invite: ${guest.invite_status}`}>
                              {guest.invite_status === 'sent' ? 'mark_email_read' : 
                               guest.invite_status === 'failed' ? 'error' : 'schedule_send'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <p className="text-[10px] text-slate-500">{guest.phone}</p>
                          <span className={`inline-flex items-center px-1.5 py-px rounded text-[8px] font-bold ${status.bg} ${status.text}`}>
                            {guest.overall_status.toUpperCase()}
                          </span>
                          <span className={`px-1.5 py-px rounded border text-[8px] font-bold capitalize ${sideColors[guest.side]?.bg} ${sideColors[guest.side]?.text}`}>
                            {guest.side} Side
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-100 shrink-0">
                      <button onClick={() => openEditDialog(guest)} className="p-1.5 text-slate-400 hover:text-primary rounded-md transition-colors" title="Edit">
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      {guest.group_id && (
                        <button onClick={() => handleRemoveFromGroup(guest.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-md transition-colors" title="Ungroup">
                          <span className="material-symbols-outlined text-[16px]">group_remove</span>
                        </button>
                      )}
                      <button onClick={() => confirmDeleteGuest(guest.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-md transition-colors" title="Delete">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pl-6">
                    <div className="flex flex-wrap gap-1">
                      {guest.tags.map(tag => (
                        <span key={tag} className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${tag.toLowerCase() === "vip" ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-600"}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    
                    <div className="flex gap-0.5">
                        {functions
                          .filter((f) => guest.function_ids.includes(f.id))
                          .map((f, i) => {
                            const colors = ["bg-blue-100 text-blue-700", "bg-orange-100 text-orange-700", "bg-purple-100 text-purple-700", "bg-pink-100 text-pink-700"];
                            return (
                              <span key={f.id} className={`size-4 flex items-center justify-center rounded-full text-[7px] font-black ${colors[i % colors.length]}`} title={f.name}>
                                {f.name[0]}
                              </span>
                            );
                        })}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          const items: React.ReactNode[] = [];
          for (const [groupId, members] of grouped.entries()) {
            const group = guestGroups.find(g => g.id === groupId);
            const isCollapsed = collapsedGroups.has(groupId);
            items.push(
              <div key={`mobile-group-${groupId}`} className="space-y-2">
                <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={members.every(m => selectedIds.has(m.id))}
                      onChange={() => {
                        const next = new Set(selectedIds);
                        const allSelected = members.every(m => selectedIds.has(m.id));
                        members.forEach(m => allSelected ? next.delete(m.id) : next.add(m.id));
                        setSelectedIds(next);
                      }}
                      className="rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <div className="flex items-center gap-2" onClick={() => toggleGroupCollapse(groupId)}>
                      <span className="material-symbols-outlined text-primary text-[20px]">family_restroom</span>
                      <span className="font-bold text-slate-900 text-sm">{group?.name}</span>
                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">{members.length}</span>
                    </div>
                  </div>
                  <button onClick={() => toggleGroupCollapse(groupId)} className="text-primary">
                    <span className="material-symbols-outlined">{isCollapsed ? "expand_more" : "expand_less"}</span>
                  </button>
                </div>
                {!isCollapsed && (
                  <div className="space-y-3">
                    {members.map(g => <GuestCard key={g.id} guest={g} isFamilyMember />)}
                  </div>
                )}
              </div>
            );
          }
          ungrouped.forEach(g => items.push(<GuestCard key={g.id} guest={g} />));
          return items.length > 0 ? items : (
            <div className="bg-slate-50 rounded-xl p-8 text-center text-slate-400 font-medium">
              No guests found matching your criteria
            </div>
          );
        })()}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
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
        <div className="fixed bottom-[110px] md:bottom-8 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-40">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl shadow-slate-900/40 flex items-center justify-between border border-white/10">
            <div className="flex items-center gap-3 pl-2 shrink-0">
              <div className="bg-primary size-8 rounded-full flex items-center justify-center font-black text-sm">
                {selectedIds.size}
              </div>
              <div>
                <p className="text-sm font-bold">{selectedIds.size} selected{selectAllFiltered ? " (all matching)" : ""}</p>
                <button onClick={clearSelection} className="text-[10px] text-slate-400 font-medium hover:text-white transition-colors">Clear selection</button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-2 hover:bg-red-500/10 text-red-400 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <span className="material-symbols-outlined text-lg">delete</span>
                Delete
              </button>
              <button
                onClick={handlePreCreateGroup}
                className="px-3 py-2 hover:bg-white/10 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <span className="material-symbols-outlined text-lg">group_add</span>
                Group
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Add Guest Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddDialog(false)}>
          <form onSubmit={(e) => { e.preventDefault(); handleAddGuest(); }} className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black text-slate-900 mb-6">Add Guest</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Name</label>
                <input
                  className="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-primary focus:border-primary"
                  value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="Guest full name"
                  autoFocus
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
                type="button"
                onClick={() => setShowAddDialog(false)}
                className="flex-1 py-2.5 border-2 border-slate-200 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-primary text-white rounded-lg font-bold text-sm hover:bg-primary/90 shadow-md shadow-primary/20"
              >
                Add Guest
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Guest Dialog */}
      {editingGuest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditingGuest(null)}>
          <form onSubmit={(e) => { e.preventDefault(); handleUpdateGuest(); }} className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900">Edit Guest</h3>
              <button type="button" onClick={() => setEditingGuest(null)} className="text-slate-400 hover:text-slate-600">
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
                  autoFocus
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
                type="button"
                onClick={() => setEditingGuest(null)}
                className="flex-1 py-2.5 border-2 border-slate-200 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-primary text-white rounded-lg font-bold text-sm hover:bg-primary/90 shadow-md shadow-primary/20"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Group Together Dialog */}
      {showGroupDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-all" onClick={() => setShowGroupDialog(false)}>
          <form onSubmit={(e) => { e.preventDefault(); handleCreateGroup(); }} className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl animate-in fade-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black text-slate-900 mb-2">Group Together</h3>
            <p className="text-sm text-slate-500 mb-6">Enter Family/Group Name (e.g. The Sharma Family):</p>
            <div className="space-y-4">
              <div>
                <input
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg text-sm focus:ring-primary focus:border-primary outline-none transition-all"
                  value={groupName} onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Family Name"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowGroupDialog(false)}
                className="flex-1 py-2.5 border-2 border-slate-200 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-primary text-white rounded-lg font-bold text-sm hover:bg-primary/90 shadow-md shadow-primary/20 transition-all"
              >
                Create Group
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Email Confirmation Dialog */}
      {showBulkEmailDialog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowBulkEmailDialog(false)}>
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-white animate-in zoom-in duration-200"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Send Invitations</h3>
              <button onClick={() => setShowBulkEmailDialog(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="space-y-4">
              {guestsWithEmail.length > 0 && (
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <div className="flex items-center gap-3 text-blue-700 mb-2">
                    <span className="material-symbols-outlined">mark_as_unread</span>
                    <span className="font-bold">Ready to Send</span>
                  </div>
                  <p className="text-sm text-blue-600 font-medium">
                    We'll send personalized email invitations to <strong>{guestsWithEmail.length}</strong> guests.
                  </p>
                </div>
              )}

              {guestsWithInvalidEmail.length > 0 && (
                <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                  <div className="flex items-center gap-3 text-red-700 mb-2">
                    <span className="material-symbols-outlined">error</span>
                    <span className="font-bold">Unsupported or Invalid Emails</span>
                  </div>
                  <p className="text-sm text-red-600 font-medium">
                    <strong>{guestsWithInvalidEmail.length}</strong> guests will be skipped. We only support Gmail, Outlook, Yahoo, and Hotmail.
                  </p>
                </div>
              )}

              {guestsWithoutEmail.length > 0 && (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <div className="flex items-center gap-3 text-amber-700 mb-2">
                    <span className="material-symbols-outlined">warning</span>
                    <span className="font-bold">Missing Info</span>
                  </div>
                  <p className="text-sm text-amber-600 font-medium">
                    <strong>{guestsWithoutEmail.length}</strong> guests will be skipped because they don't have email addresses.
                  </p>
                </div>
              )}

              <p className="text-sm text-slate-500 font-medium px-2">
                This will send each guest a personalized email with their unique RSVP link and function details.
              </p>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowBulkEmailDialog(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all active:scale-95"
                >
                  CANCEL
                </button>
                <button 
                  onClick={confirmSendEmails}
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black hover:shadow-xl hover:shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">send</span>
                  {sendingEmails ? "SENDING..." : "SEND EMAILS"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selection Progress Modal */}
      {sendingEmails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl border border-slate-100">
            <div className="size-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
              <span className="material-symbols-outlined">sync</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Sending Invitations</h3>
            <p className="text-slate-500 font-medium mb-6">Please stay on this page while we process your request.</p>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full animate-progress" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog — used for both single and bulk delete */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="size-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-3xl text-red-500">delete_forever</span>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Remove Guest{pendingDeleteId ? "" : "s"}?</h3>
                <p className="text-slate-500 font-medium">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-4 bg-red-50 rounded-2xl border border-red-100 mb-8">
              <p className="text-sm text-red-600 font-medium">
                {pendingDeleteId
                  ? "This guest and all their RSVPs, invite tokens, and seating assignments will be permanently removed."
                  : <>You are about to permanently remove <strong>{selectedIds.size}</strong> guest{selectedIds.size !== 1 ? "s" : ""}{selectAllFiltered ? " (all matching current filters)" : ""} along with their RSVPs, invite tokens, and seating assignments.</>
                }
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setPendingDeleteId(null); }}
                className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                Keep them
              </button>
              <button
                onClick={pendingDeleteId ? handleDelete : handleBulkDelete}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
