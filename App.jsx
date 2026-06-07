import React, { useState, useEffect } from "react";
import { LayoutGrid, Calendar as CalIcon, Users, Euro, History as HistoryIcon, CircleCheck as CheckCircle2, Circle as XCircle, CalendarDays, Plus, Trash2, Clock, MapPin, TrendingUp, Award, X, ChevronLeft, ChevronRight, CreditCard as Edit3, Package, LogOut, LogIn, Menu } from "lucide-react";
import { supabase } from "./src/lib/supabase";

/* ============================================================
   Deuss Studio — Massage CRM
   Theme: Gold & Black
   ============================================================ */

const THERAPISTS = [
  { name: "Dion", color: "#3b82f6", soft: "rgba(59,130,246,0.15)" },
  { name: "Nesa", color: "#ec4899", soft: "rgba(236,72,153,0.15)" },
  { name: "Arlinda", color: "#eab308", soft: "rgba(234,179,8,0.15)" },
  { name: "Diellza", color: "#a855f7", soft: "rgba(168,85,247,0.15)" },
];

const SERVICES = [
  "Dynamic Massage",
  "Styx Strong",
  "Styx Medium",
  "Face Lifting",
  "Relax Massage",
];

const ROOMS = ["Room 1", "Room 2", "Room 3", "Room 4"];
const ROOM_COUNT = ROOMS.length;
const THERAPIST_BONUS_RATE = 0.30; // 30% profit to physiotherapist
const SESSION_MIN = 60; // each session lasts 60 minutes

// Hourly grid rows shown in the calendar (08:00 .. 21:00)
const HOURS = [];
for (let h = 8; h <= 21; h++) HOURS.push(`${String(h).padStart(2, "0")}:00`);

// Bookable start times in 30-min steps (08:00 .. 20:00 so a 60-min session ends by 21:00)
const SLOTS = [];
for (let m = 8 * 60; m <= 20 * 60; m += 30) {
  SLOTS.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
}

const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const endTime = (t) => { const m = toMin(t) + SESSION_MIN; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
// Two bookings clash if their [start, start+60) intervals overlap
const overlaps = (aStart, bStart) => {
  const a = toMin(aStart), b = toMin(bStart);
  return a < b + SESSION_MIN && b < a + SESSION_MIN;
};
// Does a booking starting at `start` cover the hourly grid row `rowHour`? (row spans rowHour..rowHour+60)
const coversRow = (start, rowHour) => overlaps(start, rowHour);

const GOLD = "#c9a227";
const GOLD_LIGHT = "#e6c45a";

/* ---------- Supabase helpers ---------- */
async function loadClients() {
  const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data.map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone || "",
    soldBy: c.sold_by,
    createdAt: new Date(c.created_at).getTime(),
    packages: c.packages || [],
    legacy_packages: c.legacy_packages || [],
  }));
}

async function loadBookings() {
  const { data, error } = await supabase.from("bookings").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data.map(b => ({
    id: b.id,
    clientId: b.client_id,
    clientName: b.client_name,
    therapist: b.therapist,
    service: b.service,
    room: b.room,
    date: b.date,
    time: b.time,
    status: b.status,
    revenue: Number(b.revenue) || 0,
    packageId: b.package_id,
    isLegacy: b.is_legacy || false,
    createdAt: new Date(b.created_at).getTime(),
  }));
}

async function loadHistory() {
  const { data, error } = await supabase.from("history").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) { console.error(error); return []; }
  return data.map(h => ({
    id: h.id,
    type: h.type,
    message: h.message,
    ts: new Date(h.created_at).getTime(),
  }));
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmtEuro = (n) => `€${(Number(n) || 0).toFixed(2)}`;

// Get today's date in local timezone as ISO string (YYYY-MM-DD)
const todayISO = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const niceDate = (iso) => {
  const [year, month, day] = iso.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
};

const niceDateTime = (ts) =>
  new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const therapistColor = (name) => THERAPISTS.find((t) => t.name === name)?.color || GOLD;
const therapistSoft = (name) => THERAPISTS.find((t) => t.name === name)?.soft || "rgba(201,162,39,0.15)";

// Backward-compat: convert old single-package clients into the packages[] shape
function migrateClient(c) {
  if (Array.isArray(c.packages)) return c;
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    soldBy: c.soldBy,
    createdAt: c.createdAt,
    packages: [{
      id: uid(),
      service: c.service,
      sessions: c.sessions || 0,
      sessionsUsed: c.sessionsUsed || 0,
      paid: c.paid || 0,
      perSession: c.perSession || 0,
    }],
    legacy_packages: c.legacy_packages || [],
  };
}

/* ============================================================
   Root
   ============================================================ */
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null); // booking awaiting cancel confirmation
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Check initial auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load data when user is authenticated
  useEffect(() => {
    if (!user) {
      setClients([]);
      setBookings([]);
      setHistory([]);
      setLoaded(false);
      return;
    }
    (async () => {
      const [c, b, h] = await Promise.all([
        loadClients(),
        loadBookings(),
        loadHistory(),
      ]);
      setClients(c.map(migrateClient)); setBookings(b); setHistory(h);
      setLoaded(true);
    })();
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        setLoginError("Invalid email or password");
      } else {
        setLoginError(error.message);
      }
      return;
    }
    setLoginEmail("");
    setLoginPassword("");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setLoaded(false);
  };

  const log = async (type, message) => {
    const entry = { type, message };
    const { error } = await supabase.from("history").insert([entry]);
    if (error) console.error(error);
    setHistory((h) => [{ id: uid(), type, message, ts: Date.now() }, ...h].slice(0, 500));
  };

  /* ----- Client operations ----- */
  const addClient = async (data) => {
    const packages = data.packages.map((p) => {
      const sessions = Number(p.sessions);
      const paid = Number(p.paid);
      return {
        id: uid(),
        service: p.service,
        sessions,
        sessionsUsed: 0,
        paid,
        perSession: sessions > 0 ? paid / sessions : 0,
      };
    });
    const client = {
      name: data.name,
      phone: data.phone,
      sold_by: data.soldBy,
      packages,
      legacy_packages: data.legacy_packages || [],
    };
    const { data: inserted, error } = await supabase.from("clients").insert([client]).select();
    if (error) { console.error(error); return; }
    const saved = inserted[0];
    setClients((c) => [{
      id: saved.id,
      name: saved.name,
      phone: saved.phone || "",
      soldBy: saved.sold_by,
      packages: saved.packages,
      legacy_packages: saved.legacy_packages || [],
      createdAt: new Date(saved.created_at).getTime(),
    }, ...c]);
    const summary = packages.map((p) => `${p.sessions} ${p.service}`).join(" + ");
    const total = packages.reduce((s, p) => s + p.paid, 0);
    log("client_added",
      `Added client ${saved.name} — ${summary}, paid ${fmtEuro(total)} · sold by ${saved.sold_by}`);
  };

  const deleteClient = async (id) => {
    const cl = clients.find((c) => c.id === id);
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) { console.error(error); return; }
    setClients((c) => c.filter((x) => x.id !== id));
    // bookings cascade delete via foreign key
    setBookings((b) => b.filter((x) => x.clientId !== id));
    if (cl) log("client_deleted", `Deleted client ${cl.name}`);
  };

  const editClient = async (id, data) => {
    const old = clients.find((c) => c.id === id);
    if (!old) return;

    // Rebuild packages: keep id + sessionsUsed for existing ones, mint ids for new ones
    const newPackages = data.packages.map((p) => {
      const sessions = Number(p.sessions);
      const paid = Number(p.paid);
      const existing = p.id ? old.packages.find((op) => op.id === p.id) : null;
      const sessionsUsed = existing ? Math.min(sessions, existing.sessionsUsed) : 0;
      return {
        id: existing ? existing.id : uid(),
        service: p.service,
        sessions,
        sessionsUsed,
        paid,
        perSession: sessions > 0 ? paid / sessions : 0,
      };
    });

    const { error } = await supabase.from("clients").update({
      name: data.name,
      phone: data.phone,
      sold_by: data.soldBy,
      packages: newPackages,
      legacy_packages: data.legacy_packages || [],
    }).eq("id", id);
    if (error) { console.error(error); return; }

    setClients((cs) => cs.map((c) => c.id === id
      ? { ...c, name: data.name, phone: data.phone, soldBy: data.soldBy, packages: newPackages, legacy_packages: data.legacy_packages || [] }
      : c));

    // Build a readable change summary for History
    const changes = [];
    if (old.name !== data.name) changes.push(`name ${old.name} → ${data.name}`);
    if ((old.phone || "") !== (data.phone || "")) changes.push(`phone → ${data.phone || "—"}`);
    if (old.soldBy !== data.soldBy) changes.push(`sold by ${old.soldBy} → ${data.soldBy}`);

    const oldById = Object.fromEntries(old.packages.map((p) => [p.id, p]));
    const keptIds = new Set();
    newPackages.forEach((np) => {
      const op = oldById[np.id];
      if (!op) {
        changes.push(`added ${np.sessions} ${np.service} (${fmtEuro(np.paid)})`);
      } else {
        keptIds.add(np.id);
        if (op.service !== np.service) changes.push(`${op.service} → ${np.service}`);
        if (op.sessions !== np.sessions) changes.push(`${np.service} sessions ${op.sessions} → ${np.sessions}`);
        if (op.paid !== np.paid) changes.push(`${np.service} price ${fmtEuro(op.paid)} → ${fmtEuro(np.paid)}`);
      }
    });
    old.packages.forEach((op) => {
      if (!keptIds.has(op.id)) changes.push(`removed ${op.sessions} ${op.service}`);
    });

    log("client_edited",
      changes.length
        ? `Edited ${data.name}: ${changes.join("; ")}`
        : `Edited ${data.name} (no changes)`);
  };

  /* ----- Booking operations ----- */
  const addBooking = async (data) => {
    const client = clients.find((c) => c.id === data.clientId);
    const pkg = data.isLegacy
      ? client?.legacy_packages?.find((p) => p.id === data.packageId)
      : client?.packages?.find((p) => p.id === data.packageId);
    const booking = {
      client_id: data.clientId,
      package_id: data.packageId,
      client_name: client?.name || "—",
      therapist: data.therapist,
      service: pkg?.service || data.service,
      room: data.room,
      date: data.date,
      time: data.time,
      status: "booked",
      revenue: data.isLegacy ? 0 : (pkg?.perSession || 0),
      is_legacy: data.isLegacy || false,
    };
    const { data: inserted, error } = await supabase.from("bookings").insert([booking]).select();
    if (error) { console.error(error); return; }
    const saved = inserted[0];
    setBookings((b) => [...b, {
      id: saved.id,
      clientId: saved.client_id,
      clientName: saved.client_name,
      therapist: saved.therapist,
      service: saved.service,
      room: saved.room,
      date: saved.date,
      time: saved.time,
      status: saved.status,
      revenue: Number(saved.revenue) || 0,
      packageId: saved.package_id,
      createdAt: new Date(saved.created_at).getTime(),
      isLegacy: data.isLegacy || false,
    }]);
    log("booking_added",
      `Booked ${saved.client_name} (${saved.service}) with ${saved.therapist} • ${saved.room} • ${niceDate(saved.date)} ${saved.time}`);
  };

  const completeBooking = async (id) => {
    const done = bookings.find((x) => x.id === id);
    if (!done) return;
    const { error } = await supabase.from("bookings").update({ status: "done" }).eq("id", id);
    if (error) { console.error(error); return; }
    setBookings((b) => b.map((x) => (x.id === id ? { ...x, status: "done" } : x)));
    let counter = "";
    // increment sessions used on the matching package (regular or legacy)
    const client = clients.find((c) => c.id === done.clientId);
    if (client) {
      if (done.isLegacy) {
        // Handle legacy package
        const updatedLegacy = client.legacy_packages.map((p) => {
          if (p.id !== done.packageId) return p;
          const used = Math.min(p.sessions, (p.sessionsUsed || 0) + 1);
          counter = `${used}/${p.sessions}`;
          return { ...p, sessionsUsed: used };
        });
        await supabase.from("clients").update({ legacy_packages: updatedLegacy }).eq("id", done.clientId);
        setClients((c) => c.map((cl) => {
          if (cl.id !== done.clientId) return cl;
          return { ...cl, legacy_packages: updatedLegacy };
        }));
      } else {
        // Handle regular package
        const updatedPackages = client.packages.map((p) => {
          if (p.id !== done.packageId) return p;
          const used = Math.min(p.sessions, p.sessionsUsed + 1);
          counter = `${used}/${p.sessions}`;
          return { ...p, sessionsUsed: used };
        });
        await supabase.from("clients").update({ packages: updatedPackages }).eq("id", done.clientId);
        setClients((c) => c.map((cl) => {
          if (cl.id !== done.clientId) return cl;
          return { ...cl, packages: updatedPackages };
        }));
      }
    }
    if (!counter) {
      const cl = clients.find((x) => x.id === done.clientId);
      const p = done.isLegacy
        ? cl?.legacy_packages?.find((pp) => pp.id === done.packageId)
        : cl?.packages?.find((pp) => pp.id === done.packageId);
      if (p) counter = `${Math.min(p.sessions, (p.sessionsUsed || 0) + 1)}/${p.sessions}`;
    }
    const bonus = done.isLegacy
      ? (done.revenue || 0) * THERAPIST_BONUS_RATE
      : (done.revenue || 0) * THERAPIST_BONUS_RATE;
    log("session_done",
      `Session completed: ${done.clientName} (${done.service}) with ${done.therapist} — session ${counter} · bonus ${fmtEuro(bonus)} (${fmtEuro(done.revenue)})`);
  };

  const cancelBooking = async (id) => {
    const c = bookings.find((x) => x.id === id);
    if (!c) return;
    // If booking was completed, decrement sessions used
    if (c.status === "done") {
      const client = clients.find((cl) => cl.id === c.clientId);
      if (client) {
        if (c.isLegacy) {
          const updatedLegacy = client.legacy_packages.map((p) => {
            if (p.id !== c.packageId) return p;
            const used = Math.max(0, (p.sessionsUsed || 0) - 1);
            return { ...p, sessionsUsed: used };
          });
          await supabase.from("clients").update({ legacy_packages: updatedLegacy }).eq("id", c.clientId);
          setClients((cs) => cs.map((cl) => cl.id === c.clientId ? { ...cl, legacy_packages: updatedLegacy } : cl));
        } else {
          const updatedPackages = client.packages.map((p) => {
            if (p.id !== c.packageId) return p;
            const used = Math.max(0, p.sessionsUsed - 1);
            return { ...p, sessionsUsed: used };
          });
          await supabase.from("clients").update({ packages: updatedPackages }).eq("id", c.clientId);
          setClients((cs) => cs.map((cl) => cl.id === c.clientId ? { ...cl, packages: updatedPackages } : cl));
        }
      }
    }
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) { console.error(error); return; }
    setBookings((b) => b.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x)));
    const bonus = c.isLegacy ? 0 : ((c.revenue || 0) * THERAPIST_BONUS_RATE);
    log("booking_cancelled",
      `Cancelled ${c.clientName} with ${c.therapist} • ${niceDate(c.date)} ${c.time}${bonus > 0 ? ` · cancelled bonus ${fmtEuro(bonus)}` : ""}`);
  };

  const moveBooking = async (id, newDate, newTime, newRoom) => {
    const prev = bookings.find((x) => x.id === id);
    if (!prev) return;
    const { error } = await supabase.from("bookings").update({
      date: newDate,
      time: newTime,
      room: newRoom,
      status: "booked",
    }).eq("id", id);
    if (error) { console.error(error); return; }
    setBookings((b) => b.map((x) =>
      x.id === id ? { ...x, date: newDate, time: newTime, room: newRoom, status: "booked" } : x));
    log("booking_moved",
      `Moved ${prev.clientName}: ${niceDate(prev.date)} ${prev.time} → ${niceDate(newDate)} ${newTime} (${newRoom})`);
  };

  const deleteBooking = async (id) => {
    const bk = bookings.find((x) => x.id === id);
    // If booking was completed, decrement sessions used
    if (bk && bk.status === "done") {
      const client = clients.find((cl) => cl.id === bk.clientId);
      if (client) {
        if (bk.isLegacy) {
          const updatedLegacy = client.legacy_packages.map((p) => {
            if (p.id !== bk.packageId) return p;
            const used = Math.max(0, (p.sessionsUsed || 0) - 1);
            return { ...p, sessionsUsed: used };
          });
          await supabase.from("clients").update({ legacy_packages: updatedLegacy }).eq("id", bk.clientId);
          setClients((cs) => cs.map((cl) => cl.id === bk.clientId ? { ...cl, legacy_packages: updatedLegacy } : cl));
        } else {
          const updatedPackages = client.packages.map((p) => {
            if (p.id !== bk.packageId) return p;
            const used = Math.max(0, p.sessionsUsed - 1);
            return { ...p, sessionsUsed: used };
          });
          await supabase.from("clients").update({ packages: updatedPackages }).eq("id", bk.clientId);
          setClients((cs) => cs.map((cl) => cl.id === bk.clientId ? { ...cl, packages: updatedPackages } : cl));
        }
      }
    }
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) { console.error(error); return; }
    setBookings((b) => b.filter((x) => x.id !== id));
    if (bk) {
      const bonus = bk.isLegacy ? 0 : ((bk.revenue || 0) * THERAPIST_BONUS_RATE);
      log("booking_deleted", `Removed booking for ${bk.clientName} • ${niceDate(bk.date)} ${bk.time}${bonus > 0 ? ` · deleted bonus ${fmtEuro(bonus)}` : ""}`);
    }
  };

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "calendar", label: "Calendar", icon: CalIcon },
    { id: "clients", label: "Clients", icon: Users },
    { id: "overview", label: "Overview", icon: Package },
    { id: "revenue", label: "My revenue", icon: Euro },
    { id: "history", label: "History", icon: HistoryIcon },
  ];

  if (authLoading) {
    return (
      <div style={{ ...S.app, alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#9b9b95", fontSize: 16 }}>Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ ...S.app, alignItems: "center", justifyContent: "center" }}>
        <style>{CSS}</style>
        <div style={S.loginCard}>
          <div style={S.loginHeader}>
            <div style={S.brandName}>Deuss Studio</div>
            <div style={S.brandSub}>MASSAGE CRM</div>
          </div>
          <div style={S.navDivider} />
          <form onSubmit={handleLogin} style={{ marginTop: 24 }}>
            <Field label="Email">
              <input className="inp" style={S.input} type="email" value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)} placeholder="admin@deuss.com" required />
            </Field>
            <Field label="Password">
              <input className="inp" style={S.input} type="password" value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" required />
            </Field>
            {loginError && <div style={{ ...S.errBox, marginTop: 8 }}>{loginError}</div>}
            <button className="goldbtn" style={{ ...S.goldBtn, width: "100%", marginTop: 16, justifyContent: "center" }} type="submit">
              <LogIn size={16} /> Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={S.app}>
      <style>{CSS}</style>

      {/* Sidebar - Desktop version */}
      <aside style={S.sidebar} className="desktop-sidebar">
        <div style={S.brand}>
          <div style={S.brandName}>Deuss Studio</div>
          <div style={S.brandSub}>MASSAGE CRM</div>
        </div>
        <div style={S.navDivider} />
        <nav style={S.nav}>
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button key={n.id} className="navbtn" onClick={() => setTab(n.id)}
                style={{ ...S.navBtn, ...(active ? S.navBtnActive : {}) }}>
                <Icon size={18} color={active ? GOLD_LIGHT : "#9b9b95"} strokeWidth={1.8} />
                <span style={{ color: active ? GOLD_LIGHT : "#cfcfc8" }}>{n.label}</span>
              </button>
            );
          })}
        </nav>
        <div style={{ ...S.navDivider, marginTop: "auto" }} />
        <div style={{ padding: "0 14px 14px" }}>
          <button className="navbtn" onClick={handleLogout} style={{ ...S.navBtn, width: "100%" }}>
            <LogOut size={18} color="#9b9b95" strokeWidth={1.8} />
            <span style={{ color: "#cfcfc8" }}>Sign out</span>
          </button>
        </div>
        <div style={S.sideFoot}>
          <div style={{ fontSize: 11, color: "#6f6f68", lineHeight: 1.6 }}>
            {ROOM_COUNT} rooms · 08:00–21:00<br />Bonus {Math.round(THERAPIST_BONUS_RATE * 100)}%
          </div>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          zIndex: 40,
          display: "none",
        }} className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Mobile Sidebar */}
      <aside style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: 248,
        height: "100vh",
        background: "#100f0d",
        borderRight: "1px solid #211f1b",
        display: "none",
        flexDirection: "column",
        padding: "0 0 18px",
        zIndex: 41,
        transform: mobileMenuOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s ease",
        overflowY: "auto",
      }} className="mobile-sidebar">
        <div style={S.brand}>
          <div style={S.brandName}>Deuss Studio</div>
          <div style={S.brandSub}>MASSAGE CRM</div>
        </div>
        <div style={S.navDivider} />
        <nav style={S.nav}>
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button key={n.id} className="navbtn" onClick={() => { setTab(n.id); setMobileMenuOpen(false); }}
                style={{ ...S.navBtn, ...(active ? S.navBtnActive : {}) }}>
                <Icon size={18} color={active ? GOLD_LIGHT : "#9b9b95"} strokeWidth={1.8} />
                <span style={{ color: active ? GOLD_LIGHT : "#cfcfc8" }}>{n.label}</span>
              </button>
            );
          })}
        </nav>
        <div style={{ ...S.navDivider, marginTop: "auto" }} />
        <div style={{ padding: "0 14px 14px" }}>
          <button className="navbtn" onClick={() => { handleLogout(); setMobileMenuOpen(false); }} style={{ ...S.navBtn, width: "100%" }}>
            <LogOut size={18} color="#9b9b95" strokeWidth={1.8} />
            <span style={{ color: "#cfcfc8" }}>Sign out</span>
          </button>
        </div>
        <div style={S.sideFoot}>
          <div style={{ fontSize: 11, color: "#6f6f68", lineHeight: 1.6 }}>
            {ROOM_COUNT} rooms · 08:00–21:00<br />Bonus {Math.round(THERAPIST_BONUS_RATE * 100)}%
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={S.main}>
        {/* Mobile Header with Hamburger */}
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 60,
          background: "#100f0d",
          borderBottom: "1px solid #211f1b",
          display: "none",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          zIndex: 30,
        }} className="mobile-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{
              background: "transparent",
              border: "none",
              color: GOLD,
              cursor: "pointer",
              padding: 8,
              display: "flex",
            }}>
              <Menu size={24} strokeWidth={2} />
            </button>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: GOLD }}>Deuss</div>
              <div style={{ fontSize: 9, color: "#8a8a83" }}>CRM</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{
            background: "transparent",
            border: "none",
            color: "#9b9b95",
            cursor: "pointer",
            padding: 8,
            display: "flex",
          }}>
            <LogOut size={20} strokeWidth={1.8} />
          </button>
        </div>

        {!loaded ? (
          <div style={{ color: "#9b9b95", padding: 40 }}>Loading…</div>
        ) : (
          <>
            {tab === "dashboard" && <Dashboard bookings={bookings} clients={clients} onComplete={completeBooking} onCancel={setCancelTarget} />}
            {tab === "calendar" && <CalendarView bookings={bookings} clients={clients} onAdd={addBooking} onComplete={completeBooking} onCancel={setCancelTarget} onMove={moveBooking} onDelete={deleteBooking} />}
            {tab === "clients" && <Clients clients={clients} bookings={bookings} onAdd={addClient} onEdit={editClient} onDelete={deleteClient} />}
            {tab === "overview" && <Overview clients={clients} bookings={bookings} />}
            {tab === "revenue" && <Revenue bookings={bookings} clients={clients} />}
            {tab === "history" && <History history={history} />}
          </>
        )}
      </main>

      {cancelTarget && (
        <Modal title="Cancel appointment?" onClose={() => setCancelTarget(null)}>
          <p style={{ color: "#cfcfc8", fontSize: 14.5, lineHeight: 1.6, marginTop: 4 }}>
            Cancel <b style={{ color: "#f1ead6" }}>{cancelTarget.clientName}</b>'s appointment
            {cancelTarget.service ? ` (${cancelTarget.service})` : ""} with{" "}
            <b style={{ color: therapistColor(cancelTarget.therapist) }}>{cancelTarget.therapist}</b> on{" "}
            {niceDate(cancelTarget.date)} at {cancelTarget.time}? This frees the room and is recorded in History.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button className="mini" style={{ ...S.miniGhost, flex: 1, padding: "11px 0" }} onClick={() => setCancelTarget(null)}>
              Keep it
            </button>
            <button className="mini" style={S.dangerBtn} onClick={() => { cancelBooking(cancelTarget.id); setCancelTarget(null); }}>
              <XCircle size={15} /> Cancel appointment
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================================================
   Dashboard
   ============================================================ */
function Dashboard({ bookings, clients, onComplete, onCancel }) {
  const monthKey = todayISO().slice(0, 7);
  const inMonth = (iso) => iso?.slice(0, 7) === monthKey;

  const sessionsDone = bookings.filter((b) => b.status === "done" && inMonth(b.date)).length;
  const cancellations = bookings.filter((b) => b.status === "cancelled" && inMonth(b.date)).length;
  const revenue = bookings.filter((b) => b.status === "done" && inMonth(b.date) && !b.isLegacy).reduce((s, b) => s + b.revenue, 0);
  const packagesValue = clients
    .filter((c) => inMonth(new Date(c.createdAt).toISOString()))
    .reduce((s, c) => s + (c.packages || []).reduce((a, p) => a + p.paid, 0), 0);

  const today = todayISO();
  const todays = bookings
    .filter((b) => b.date === today && b.status !== "cancelled")
    .sort((a, b) => a.time.localeCompare(b.time));

  const cards = [
    { label: "SESSIONS DONE (MONTH)", value: sessionsDone, icon: CheckCircle2 },
    { label: "CANCELLATIONS (MONTH)", value: cancellations, icon: XCircle },
    { label: "YOUR REVENUE (MONTH)", value: fmtEuro(revenue), icon: Euro },
    { label: "PACKAGES SOLD (MONTH)", value: fmtEuro(packagesValue), icon: CalendarDays },
  ];

  return (
    <div className="fade">
      <h1 style={S.h1}>Hello, Dion</h1>
      <p style={S.sub}>Your month at a glance</p>
      <div style={S.hr} />

      <div style={S.cardRow}>
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="card" style={S.statCard}>
              <div style={S.statTop}>
                <span style={S.statLabel}>{c.label}</span>
                <Icon size={18} color={GOLD} strokeWidth={1.6} />
              </div>
              <div style={S.statValue}>{c.value}</div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ ...S.panel, marginTop: 22 }}>
        <h2 style={S.h2}>Today's appointments</h2>
        {todays.length === 0 ? (
          <p style={{ color: "#8a8a83", marginTop: 14 }}>No appointments today.</p>
        ) : (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {todays.map((b) => (
              <div key={b.id} style={S.todayRow}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ ...S.dot, background: therapistColor(b.therapist) }} />
                  <div>
                    <div style={{ color: "#f1ead6", fontWeight: 600 }}>{b.clientName}</div>
                    <div style={{ fontSize: 12.5, color: "#9b9b95" }}>
                      {b.time} · {b.service} · {b.room} · {b.therapist}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {b.status === "done" ? (
                    <span style={S.badgeDone}>Done</span>
                  ) : (
                    <>
                      <button className="mini" style={S.miniGold} onClick={() => onComplete(b.id)}>Complete</button>
                      <button className="mini" style={S.miniGhost} onClick={() => onCancel(b)}>Cancel</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Clients
   ============================================================ */
function Clients({ clients, bookings, onAdd, onEdit, onDelete }) {
  const [formState, setFormState] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const totalPages = Math.ceil(clients.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const paginatedClients = clients.slice(start, start + itemsPerPage);

  return (
    <div className="fade">
      <div style={S.pageHead}>
        <div>
          <h1 style={S.h1}>Clients</h1>
          <p style={S.sub}>{clients.length} clients · Multiple packages per client · edits are saved to History</p>
        </div>
        <button className="goldbtn" style={S.goldBtn} onClick={() => setFormState({ mode: "add" })}>
          <Plus size={16} /> Add client
        </button>
      </div>
      <div style={S.hr} />

      {clients.length === 0 ? (
        <div className="card" style={S.panel}><p style={{ color: "#8a8a83" }}>No clients yet. Add your first one above.</p></div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="clients-table-wrapper card" style={{ ...S.panel, padding: 0, overflow: "hidden", marginTop: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #221f1a", background: "#15130f" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#8a8a83", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Name</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#8a8a83", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Phone</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#8a8a83", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Sold by</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#8a8a83", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Packages</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, color: "#8a8a83", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Total Paid</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, color: "#8a8a83", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClients.map((c) => {
                  const totalPaid = c.packages.reduce((s, p) => s + p.paid, 0);
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid #1c1a16", transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = "#1a1814"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "12px 16px", fontSize: 14, color: "#f1ead6", fontWeight: 500 }}>{c.name}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "#9b9b95" }}>{c.phone || "—"}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12 }}>
                        {c.soldBy ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 6, background: therapistSoft(c.soldBy), border: `1px solid ${therapistColor(c.soldBy)}44` }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: therapistColor(c.soldBy) }} />
                            <span style={{ color: therapistColor(c.soldBy), fontWeight: 600 }}>{c.soldBy}</span>
                          </div>
                        ) : (
                          <span style={{ color: "#6f6f68" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#8a8a83" }}>{c.packages.length} pkg{c.packages.length !== 1 ? "s" : ""}</td>
                      <td style={{ padding: "12px 16px", fontSize: 14, color: GOLD_LIGHT, fontWeight: 600, textAlign: "right" }}>{fmtEuro(totalPaid)}</td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                          <button className="iconbtn" style={{ ...S.iconBtn, width: 26, height: 26 }} onClick={() => setFormState({ mode: "edit", client: c })} title="Edit">
                            <Edit3 size={13} color="#8a8a83" />
                          </button>
                          <button className="iconbtn" style={{ ...S.iconBtn, width: 26, height: 26 }} onClick={() => setConfirmDel(c)} title="Delete">
                            <Trash2 size={13} color="#8a8a83" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="clients-mobile-cards" style={{ display: "none", gridTemplateColumns: "1fr", gap: 12, marginTop: 16 }}>
            {paginatedClients.map((c) => {
              const totalPaid = c.packages.reduce((s, p) => s + p.paid, 0);
              return (
                <div key={c.id} className="card" style={{ ...S.panel, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, color: "#f1ead6", fontWeight: 600 }}>{c.name}</div>
                      {c.phone && <div style={{ fontSize: 12, color: "#9b9b95", marginTop: 4 }}>{c.phone}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="iconbtn" style={{ ...S.iconBtn, width: 26, height: 26 }} onClick={() => setFormState({ mode: "edit", client: c })} title="Edit">
                        <Edit3 size={13} color="#8a8a83" />
                      </button>
                      <button className="iconbtn" style={{ ...S.iconBtn, width: 26, height: 26 }} onClick={() => setConfirmDel(c)} title="Delete">
                        <Trash2 size={13} color="#8a8a83" />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 12, borderTop: "1px solid #221f1a" }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#8a8a83", textTransform: "uppercase", letterSpacing: 0.8 }}>Sold by</div>
                      {c.soldBy ? (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 6, background: therapistSoft(c.soldBy), border: `1px solid ${therapistColor(c.soldBy)}44`, marginTop: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: therapistColor(c.soldBy) }} />
                          <span style={{ color: therapistColor(c.soldBy), fontWeight: 600, fontSize: 12 }}>{c.soldBy}</span>
                        </div>
                      ) : (
                        <span style={{ color: "#6f6f68", fontSize: 12, marginTop: 4 }}>—</span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#8a8a83", textTransform: "uppercase", letterSpacing: 0.8 }}>Packages</div>
                      <div style={{ fontSize: 13, color: "#cfcfc8", marginTop: 4 }}>{c.packages.length}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#8a8a83", textTransform: "uppercase", letterSpacing: 0.8 }}>Total Paid</div>
                      <div style={{ fontSize: 14, color: GOLD_LIGHT, fontWeight: 600, marginTop: 4 }}>{fmtEuro(totalPaid)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 20 }}>
              <button
                className="iconbtn"
                style={S.navArrow}
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                title="Previous page"
              >
                <ChevronLeft size={18} color={currentPage === 1 ? "#3a3630" : GOLD} />
              </button>
              <span style={{ color: "#8a8a83", fontSize: 13, minWidth: 80, textAlign: "center" }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="iconbtn"
                style={S.navArrow}
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                title="Next page"
              >
                <ChevronRight size={18} color={currentPage === totalPages ? "#3a3630" : GOLD} />
              </button>
            </div>
          )}
        </>
      )}

      {formState && (
        <ClientFormModal
          mode={formState.mode}
          client={formState.client}
          bookings={bookings}
          onClose={() => setFormState(null)}
          onSubmit={(data) => {
            if (formState.mode === "edit") onEdit(formState.client.id, data);
            else onAdd(data);
            setFormState(null);
          }}
        />
      )}

      {confirmDel && (
        <Modal title="Delete client?" onClose={() => setConfirmDel(null)}>
          <p style={{ color: "#cfcfc8", fontSize: 14.5, lineHeight: 1.6, marginTop: 4 }}>
            This will permanently remove <b style={{ color: "#f1ead6" }}>{confirmDel.name}</b>, all their packages, and any bookings tied to them. This can't be undone.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button className="mini" style={{ ...S.miniGhost, flex: 1, padding: "11px 0" }} onClick={() => setConfirmDel(null)}>
              Cancel
            </button>
            <button className="mini" style={S.dangerBtn} onClick={() => { onDelete(confirmDel.id); setConfirmDel(null); }}>
              <Trash2 size={15} /> Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ClientFormModal({ mode, client, bookings, onClose, onSubmit }) {
  const blankPkg = () => ({ key: uid(), id: null, service: SERVICES[0], sessions: "", paid: "" });
  const blankLegacy = () => ({ key: uid(), id: uid(), service: SERVICES[0], sessions: "", paid: "", therapist: THERAPISTS[0].name, sessionsUsed: 0 });
  const isEdit = mode === "edit";

  const [name, setName] = useState(isEdit ? client.name : "");
  const [phone, setPhone] = useState(isEdit ? (client.phone || "") : "");
  const [soldBy, setSoldBy] = useState(isEdit ? client.soldBy : THERAPISTS[0].name);
  const [pkgs, setPkgs] = useState(
    isEdit
      ? client.packages.map((p) => ({ key: p.id, id: p.id, service: p.service, sessions: String(p.sessions), paid: String(p.paid), sessionsUsed: p.sessionsUsed }))
      : [blankPkg()]
  );
  const [legacyPkgs, setLegacyPkgs] = useState(
    isEdit && client.legacy_packages
      ? client.legacy_packages.map((p) => ({ key: uid(), id: p.id || uid(), service: p.service, sessions: String(p.sessions), paid: String(p.paid || ""), therapist: p.therapist, sessionsUsed: p.sessionsUsed || 0 }))
      : []
  );

  const updatePkg = (key, field, val) =>
    setPkgs((ps) => ps.map((p) => (p.key === key ? { ...p, [field]: val } : p)));
  const addPkgRow = () => setPkgs((ps) => [...ps, blankPkg()]);
  const removePkgRow = (key) => setPkgs((ps) => (ps.length > 1 ? ps.filter((p) => p.key !== key) : ps));

  const updateLegacy = (key, field, val) =>
    setLegacyPkgs((ps) => ps.map((p) => (p.key === key ? { ...p, [field]: val } : p)));
  const addLegacyRow = () => setLegacyPkgs((ps) => [...ps, blankLegacy()]);
  const removeLegacyRow = (key) => setLegacyPkgs((ps) => ps.filter((p) => p.key !== key));

  // booked-but-not-done sessions per existing package (to warn against shrinking below committed sessions)
  const committedFor = (pkgId) => {
    if (!pkgId) return 0;
    const used = client?.packages.find((p) => p.id === pkgId)?.sessionsUsed || 0;
    const booked = bookings.filter((b) => b.packageId === pkgId && b.status === "booked").length;
    return used + booked;
  };

  const validPkgs = pkgs.filter((p) => Number(p.sessions) > 0 && p.paid !== "" && Number(p.paid) >= 0);
  const grandTotal = validPkgs.reduce((s, p) => s + Number(p.paid), 0);

  const submit = () => {
    if (!name.trim() || (validPkgs.length === 0 && validLegacy.length === 0)) return;
    const validLegacy = legacyPkgs.filter((p) => Number(p.sessions) > 0 && p.paid !== "" && Number(p.paid) >= 0);
    onSubmit({
      name: name.trim(),
      phone,
      soldBy,
      packages: validPkgs.map((p) => ({ id: p.id || undefined, service: p.service, sessions: p.sessions, paid: p.paid })),
      legacy_packages: validLegacy.length > 0 ? validLegacy.map((p) => ({ id: p.id, service: p.service, sessions: Number(p.sessions), paid: Number(p.paid), therapist: p.therapist, sessionsUsed: p.sessionsUsed || 0 })) : [],
    });
  };

  return (
    <Modal title={isEdit ? `Edit ${client.name}` : "Add client"} onClose={onClose}>
      <Field label="Name">
        <input className="inp" style={S.input} value={name}
          onChange={(e) => setName(e.target.value)} placeholder="e.g. Lena" />
      </Field>
      <Field label="Phone">
        <input className="inp" style={S.input} value={phone}
          onChange={(e) => setPhone(e.target.value)} placeholder="+38344888111" />
      </Field>
      <Field label="Sold by (physiotherapist)">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {THERAPISTS.map((t) => (
            <button key={t.name} className="mini"
              onClick={() => setSoldBy(t.name)}
              style={{
                ...S.therChip,
                borderColor: soldBy === t.name ? t.color : "#2a2a26",
                background: soldBy === t.name ? t.soft : "transparent",
                color: soldBy === t.name ? "#f1ead6" : "#9b9b95",
              }}>
              <span style={{ ...S.dot, width: 9, height: 9, background: t.color }} /> {t.name}
            </button>
          ))}
        </div>
      </Field>

      <label style={S.fieldLabel}>Packages</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pkgs.map((p, i) => {
          const per = Number(p.sessions) > 0 ? Number(p.paid) / Number(p.sessions) : 0;
          const committed = committedFor(p.id);
          const tooLow = p.id && Number(p.sessions) > 0 && Number(p.sessions) < committed;
          return (
            <div key={p.key} style={S.pkgEditRow}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#8a8a83", fontWeight: 600 }}>
                  Package {i + 1}{p.id ? ` · ${p.sessionsUsed} done` : " · new"}
                </span>
                {pkgs.length > 1 && (
                  <button className="iconbtn" style={{ ...S.iconBtn, width: 26, height: 26 }} onClick={() => removePkgRow(p.key)} title="Remove">
                    <X size={13} color="#8a8a83" />
                  </button>
                )}
              </div>
              <select className="inp" style={{ ...S.input, marginBottom: 8 }} value={p.service}
                onChange={(e) => updatePkg(p.key, "service", e.target.value)}>
                {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="inp" style={S.input} type="number" min="1" value={p.sessions}
                  onChange={(e) => updatePkg(p.key, "sessions", e.target.value)} placeholder="Sessions e.g. 10" />
                <input className="inp" style={S.input} type="number" min="0" value={p.paid}
                  onChange={(e) => updatePkg(p.key, "paid", e.target.value)} placeholder="Paid € e.g. 270" />
              </div>
              {tooLow && (
                <div style={{ fontSize: 11.5, color: "#fca5a5", marginTop: 7 }}>
                  {committed} sessions already used/booked — will clamp to {committed}.
                </div>
              )}
              {per > 0 && (
                <div style={{ fontSize: 12, color: GOLD_LIGHT, marginTop: 7, textAlign: "right" }}>
                  = {fmtEuro(per)} / session
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button className="mini" style={S.addPkgBtn} onClick={addPkgRow}>
        <Plus size={14} /> Add another package
      </button>

      {/* Legacy packages section */}
      <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #221f1a" }}>
        <label style={S.fieldLabel}>Legacy packages (old client)
          <span style={{ fontSize: 11, color: "#8a8a83", fontWeight: 400, display: "block", marginTop: 2 }}>
            For tracking historical sessions &amp; bonus. Not included in revenue/packages sold.
          </span>
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {legacyPkgs.map((p, i) => (
            <div key={p.key} style={S.pkgEditRow}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#8a8a83", fontWeight: 600 }}>Legacy {i + 1}</span>
                <button className="iconbtn" style={{ ...S.iconBtn, width: 26, height: 26 }} onClick={() => removeLegacyRow(p.key)} title="Remove">
                  <X size={13} color="#8a8a83" />
                </button>
              </div>
              <select className="inp" style={{ ...S.input, marginBottom: 8 }} value={p.service}
                onChange={(e) => updateLegacy(p.key, "service", e.target.value)}>
                {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="inp" style={{ ...S.input, flex: 1 }} type="number" min="1" value={p.sessions}
                  onChange={(e) => updateLegacy(p.key, "sessions", e.target.value)} placeholder="Sessions" />
                <input className="inp" style={{ ...S.input, flex: 1 }} type="number" min="0" value={p.paid}
                  onChange={(e) => updateLegacy(p.key, "paid", e.target.value)} placeholder="Paid €" />
                <div style={{ display: "flex", gap: 8, flex: 1, alignItems: "center" }}>
                  <span style={{ color: "#8a8a83", fontSize: 12 }}>Therapist</span>
                  <select className="inp" style={{ ...S.input, flex: 1 }} value={p.therapist}
                    onChange={(e) => updateLegacy(p.key, "therapist", e.target.value)}>
                    {THERAPISTS.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              {Number(p.sessions) > 0 && Number(p.paid) > 0 && (
                <div style={{ fontSize: 12, color: GOLD_LIGHT, marginTop: 7, textAlign: "right" }}>
                  = {fmtEuro(Number(p.paid) / Number(p.sessions))} / session
                </div>
              )}
            </div>
          ))}
        </div>
        {legacyPkgs.length > 0 && (
          <button className="mini" style={S.addPkgBtn} onClick={addLegacyRow}>
            <Plus size={14} /> Add another legacy
          </button>
        )}
        {legacyPkgs.length === 0 && (
          <button className="mini" style={{ ...S.addPkgBtn, opacity: 0.6 }} onClick={addLegacyRow}>
            <Plus size={14} /> Add legacy package
          </button>
        )}
      </div>

      <div style={{ ...S.calcBox, marginTop: 14 }}>
        <span style={{ color: "#9b9b95", fontSize: 13 }}>Total{isEdit ? "" : " to pay"}</span>
        <span style={{ color: GOLD_LIGHT, fontWeight: 700, fontSize: 16 }}>{fmtEuro(grandTotal)}</span>
      </div>
      <button className="goldbtn" style={{ ...S.goldBtn, width: "100%", marginTop: 16, justifyContent: "center" }} onClick={submit}>
        {isEdit ? "Save changes" : "Save client"}
      </button>
    </Modal>
  );
}

/* ============================================================
   Calendar
   ============================================================ */
function CalendarView({ bookings, clients, onAdd, onComplete, onCancel, onMove, onDelete }) {
  const [date, setDate] = useState(todayISO());
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState(null); // { time, room }
  const [moveTarget, setMoveTarget] = useState(null);

  const dayBookings = bookings.filter((b) => b.date === date && b.status !== "cancelled");

  // Booking whose start falls inside this hourly row (i.e. it begins at rowHour or rowHour:30)
  const startingIn = (rowHour, room) =>
    dayBookings.find((b) => b.room === room && toMin(b.time) >= toMin(rowHour) && toMin(b.time) < toMin(rowHour) + 60);
  // Booking from a previous row that spills into this row (e.g. 8:30 booking covering the 9:00 row)
  const spillingInto = (rowHour, room) =>
    dayBookings.find((b) => b.room === room && toMin(b.time) < toMin(rowHour) && coversRow(b.time, rowHour));

  const shiftDay = (delta) => {
    const currentDate = new Date(date);
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + delta);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setDate(`${year}-${month}-${day}`);
  };

  const openSlot = (time, room) => {
    if (startingIn(time, room) || spillingInto(time, room)) return;
    setPreset({ time, room });
    setOpen(true);
  };

  return (
    <div className="fade">
      <div style={S.pageHead}>
        <div>
          <h1 style={S.h1}>Calendar</h1>
          <p style={S.sub}>{ROOM_COUNT} rooms · 08:00–21:00 · 30-min slots · 1-hour sessions</p>
        </div>
        <button className="goldbtn" style={S.goldBtn} onClick={() => { setPreset(null); setOpen(true); }}>
          <Plus size={16} /> New booking
        </button>
      </div>
      <div style={S.hr} />

      <div style={S.dateNav}>
        <button className="iconbtn" style={S.navArrow} onClick={() => shiftDay(-1)}><ChevronLeft size={18} color={GOLD} /></button>
        <input className="inp" style={{ ...S.input, width: "auto", textAlign: "center" }} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="iconbtn" style={S.navArrow} onClick={() => shiftDay(1)}><ChevronRight size={18} color={GOLD} /></button>
        <span style={{ marginLeft: 8, color: "#9b9b95", fontSize: 14 }}>{niceDate(date)}</span>
      </div>

      <div className="card" style={{ ...S.panel, padding: 0, overflow: "hidden", marginTop: 16 }}>
        <div style={S.gridScroll}>
          <div style={{ ...S.gridRow, ...S.gridHeadRow }}>
            <div style={{ ...S.gridTimeCell, ...S.gridHeadCell }}>Time</div>
            {ROOMS.map((r) => <div key={r} style={{ ...S.gridCell, ...S.gridHeadCell }}>{r}</div>)}
          </div>
          {HOURS.map((time) => (
            <div key={time} style={S.gridRow}>
              <div style={S.gridTimeCell}>{time}</div>
              {ROOMS.map((room) => {
                const bk = startingIn(time, room);
                const spill = !bk && spillingInto(time, room);
                return (
                  <div key={room} style={S.gridCell}>
                    {bk ? (
                      <div style={{ ...S.slotCard, borderColor: therapistColor(bk.therapist), background: therapistSoft(bk.therapist) }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ color: "#f1ead6", fontWeight: 600, fontSize: 13 }}>{bk.clientName}</span>
                          <span style={{ ...S.dot, width: 8, height: 8, background: therapistColor(bk.therapist) }} />
                        </div>
                        <div style={{ fontSize: 11, color: GOLD_LIGHT, marginTop: 2, fontWeight: 600 }}>{bk.time}–{endTime(bk.time)}</div>
                        <div style={{ fontSize: 11, color: "#b6b6ad", marginTop: 1 }}>{bk.service}</div>
                        <div style={{ fontSize: 11, color: therapistColor(bk.therapist), marginTop: 1, fontWeight: 600 }}>{bk.therapist}</div>
                        <div style={{ display: "flex", gap: 5, marginTop: 7, flexWrap: "wrap" }}>
                          {bk.status === "done"
                            ? <span style={S.badgeDoneSm}>Done</span>
                            : <button className="mini" style={S.slotMiniGold} onClick={() => onComplete(bk.id)}>✓</button>}
                          <button className="mini" style={S.slotMini} onClick={() => setMoveTarget(bk)} title="Move">⇄</button>
                          <button className="mini" style={S.slotMini} onClick={() => onCancel(bk)} title="Cancel">✕</button>
                        </div>
                      </div>
                    ) : spill ? (
                      <div style={S.busyCell} title={`In use until ${endTime(spill.time)} (${spill.clientName})`}>
                        <span style={{ ...S.dot, width: 7, height: 7, background: therapistColor(spill.therapist) }} />
                        <span>busy · ends {endTime(spill.time)}</span>
                      </div>
                    ) : (
                      <button className="emptyslot" style={S.emptySlot} onClick={() => openSlot(time, room)}>
                        <Plus size={14} color="#5a5a52" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {open && (
        <BookingModal
          clients={clients} bookings={bookings} date={date} preset={preset}
          onClose={() => setOpen(false)}
          onSave={(d) => { onAdd(d); setOpen(false); }}
        />
      )}

      {moveTarget && (
        <MoveModal
          booking={moveTarget} bookings={bookings}
          onClose={() => setMoveTarget(null)}
          onSave={(nd, nt, nr) => { onMove(moveTarget.id, nd, nt, nr); setMoveTarget(null); }}
        />
      )}
    </div>
  );
}

function BookingModal({ clients, bookings, date, preset, onClose, onSave }) {
  const firstClient = clients[0];
  const firstPkg = firstClient?.packages?.[0] || firstClient?.legacy_packages?.[0];
  const [f, setF] = useState({
    clientId: firstClient?.id || "",
    packageId: firstPkg?.id || "",
    isLegacy: !firstClient?.packages?.[0],
    therapist: THERAPISTS[0].name,
    room: preset?.room || ROOMS[0],
    date,
    time: preset?.time || HOURS[0],
  });
  const [err, setErr] = useState("");

  const client = clients.find((c) => c.id === f.clientId);
  const clientPkgs = client?.packages || [];
  const clientLegacyPkgs = client?.legacy_packages || [];
  const selectedPkg = f.isLegacy
    ? clientLegacyPkgs.find((p) => p.id === f.packageId)
    : clientPkgs.find((p) => p.id === f.packageId);

  const onClientChange = (id) => {
    const c = clients.find((x) => x.id === id);
    const firstPkg = c?.packages?.[0] || c?.legacy_packages?.[0];
    setF({ ...f, clientId: id, packageId: firstPkg?.id || "", isLegacy: !c?.packages?.[0] });
  };

  const clash = bookings.find((b) =>
    b.status !== "cancelled" && b.date === f.date && b.room === f.room && overlaps(b.time, f.time));

  // a room is free at this start time if no active booking overlaps it
  const freeRoomsAt = ROOMS.filter((r) =>
    !bookings.some((b) => b.status !== "cancelled" && b.date === f.date && b.room === r && overlaps(b.time, f.time)));
  const allRoomsBooked = freeRoomsAt.length === 0;

  // sessions already used + still-booked for this package
  const pkgBooked = selectedPkg
    ? bookings.filter((b) => b.packageId === selectedPkg.id && b.status === "booked").length
    : 0;
  const pkgRemaining = selectedPkg ? selectedPkg.sessions - selectedPkg.sessionsUsed - pkgBooked : 0;

  const submit = () => {
    if (!f.clientId) { setErr("Select a client first (add one in Clients)."); return; }
    if (!f.packageId) { setErr("Select a package."); return; }
    if (clash) { setErr(`${f.room} is in use during ${f.time}–${endTime(f.time)}.`); return; }
    if (allRoomsBooked) { setErr(`All ${ROOM_COUNT} rooms are busy during ${f.time}–${endTime(f.time)}.`); return; }
    if (pkgRemaining <= 0) { setErr(`No sessions left in this package.`); return; }
    onSave({ ...f, service: selectedPkg?.service });
  };

  return (
    <Modal title="New booking" onClose={onClose}>
      <Field label="Client">
        <select className="inp" style={S.input} value={f.clientId} onChange={(e) => onClientChange(e.target.value)}>
          {clients.length === 0 && <option value="">No clients — add one first</option>}
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Package (service)">
        {clientPkgs.length === 0 && clientLegacyPkgs.length === 0 ? (
          <div style={{ ...S.input, color: "#8a8a83" }}>No packages</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {clientPkgs.map((p) => {
              const booked = bookings.filter((b) => b.packageId === p.id && b.status === "booked").length;
              const left = p.sessions - p.sessionsUsed - booked;
              const active = f.packageId === p.id && !f.isLegacy;
              return (
                <button key={p.id} className="mini"
                  onClick={() => setF({ ...f, packageId: p.id, isLegacy: false })}
                  style={{
                    ...S.pkgSelectRow,
                    borderColor: active ? GOLD : "#2a2a26",
                    background: active ? "rgba(201,162,39,0.1)" : "transparent",
                  }}>
                  <span style={{ color: active ? "#f1ead6" : "#cfcfc8", fontWeight: 600, fontSize: 13.5 }}>{p.service}</span>
                  <span style={{ fontSize: 12, color: left > 0 ? GOLD_LIGHT : "#f87171" }}>
                    {left} left · {fmtEuro(p.perSession)}
                  </span>
                </button>
              );
            })}
            {clientLegacyPkgs.length > 0 && clientPkgs.length > 0 && (
              <div style={{ height: 1, background: "#2a2a26", margin: "4px 0" }} />
            )}
            {clientLegacyPkgs.map((p) => {
              const booked = bookings.filter((b) => b.packageId === p.id && b.status === "booked").length;
              const left = p.sessions - (p.sessionsUsed || 0) - booked;
              const perSession = Number(p.paid) > 0 ? Number(p.paid) / Number(p.sessions) : 0;
              const active = f.packageId === p.id && f.isLegacy;
              return (
                <button key={p.id} className="mini"
                  onClick={() => setF({ ...f, packageId: p.id, isLegacy: true })}
                  style={{
                    ...S.pkgSelectRow,
                    borderColor: active ? GOLD : "#2a2a26",
                    background: active ? "rgba(201,162,39,0.1)" : "transparent",
                    opacity: 0.85,
                  }}>
                  <span style={{ color: active ? "#f1ead6" : "#cfcfc8", fontWeight: 600, fontSize: 13.5 }}>{p.service} <span style={{ fontSize: 11, color: "#8a8a83" }}>(legacy)</span></span>
                  <span style={{ fontSize: 12, color: left > 0 ? GOLD_LIGHT : "#f87171" }}>
                    {left} left · {fmtEuro(perSession)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Field>
      <Field label="Therapist">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {THERAPISTS.map((t) => (
            <button key={t.name} className="mini"
              onClick={() => setF({ ...f, therapist: t.name })}
              style={{
                ...S.therChip,
                borderColor: f.therapist === t.name ? t.color : "#2a2a26",
                background: f.therapist === t.name ? t.soft : "transparent",
                color: f.therapist === t.name ? "#f1ead6" : "#9b9b95",
              }}>
              <span style={{ ...S.dot, width: 9, height: 9, background: t.color }} /> {t.name}
            </button>
          ))}
        </div>
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Date" style={{ flex: 1 }}>
          <input className="inp" style={S.input} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Time" style={{ flex: 1 }}>
          <select className="inp" style={S.input} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })}>
            {SLOTS.map((h) => <option key={h} value={h}>{h}–{endTime(h)}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Room">
        <div style={{ display: "flex", gap: 8 }}>
          {ROOMS.map((r) => {
            const taken = bookings.find((b) => b.status !== "cancelled" && b.date === f.date && b.room === r && overlaps(b.time, f.time));
            return (
              <button key={r} className="mini" disabled={!!taken}
                onClick={() => setF({ ...f, room: r })}
                style={{
                  ...S.roomChip,
                  opacity: taken ? 0.4 : 1,
                  borderColor: f.room === r ? GOLD : "#2a2a26",
                  background: f.room === r ? "rgba(201,162,39,0.12)" : "transparent",
                  color: f.room === r ? GOLD_LIGHT : "#9b9b95",
                  cursor: taken ? "not-allowed" : "pointer",
                }}>
                {r}{taken ? " · busy" : ""}
              </button>
            );
          })}
        </div>
      </Field>
      {err && <div style={S.errBox}>{err}</div>}
      <button className="goldbtn" style={{ ...S.goldBtn, width: "100%", marginTop: 16, justifyContent: "center" }} onClick={submit}>
        Confirm booking
      </button>
    </Modal>
  );
}

function MoveModal({ booking, bookings, onClose, onSave }) {
  const [f, setF] = useState({ date: booking.date, time: booking.time, room: booking.room });
  const [err, setErr] = useState("");
  const submit = () => {
    const clash = bookings.find((b) =>
      b.id !== booking.id && b.status !== "cancelled" &&
      b.date === f.date && b.room === f.room && overlaps(b.time, f.time));
    if (clash) { setErr(`${f.room} is in use during ${f.time}–${endTime(f.time)}.`); return; }
    onSave(f.date, f.time, f.room);
  };
  return (
    <Modal title={`Move — ${booking.clientName}`} onClose={onClose}>
      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Date" style={{ flex: 1 }}>
          <input className="inp" style={S.input} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Time" style={{ flex: 1 }}>
          <select className="inp" style={S.input} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })}>
            {SLOTS.map((h) => <option key={h} value={h}>{h}–{endTime(h)}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Room">
        <select className="inp" style={S.input} value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })}>
          {ROOMS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </Field>
      {err && <div style={S.errBox}>{err}</div>}
      <button className="goldbtn" style={{ ...S.goldBtn, width: "100%", marginTop: 16, justifyContent: "center" }} onClick={submit}>
        Move booking
      </button>
    </Modal>
  );
}

/* ============================================================
   Overview
   ============================================================ */
function Overview({ clients, bookings }) {
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");
  const [backupRange, setBackupRange] = useState("all"); // today, week, month, all

  const allPkgs = clients.flatMap((c) => c.packages || []);
  const totalPackages = allPkgs.length;
  const totalPackageValue = allPkgs.reduce((s, p) => s + p.paid, 0);
  const totalSessionsSold = allPkgs.reduce((s, p) => s + p.sessions, 0);
  const sessionsDone = bookings.filter((b) => b.status === "done").length;
  const cancellations = bookings.filter((b) => b.status === "cancelled").length;
  const upcoming = bookings.filter((b) => b.status === "booked").length;
  const totalRevenue = bookings.filter((b) => b.status === "done").reduce((s, b) => s + b.revenue, 0);

  // packages by service
  const byService = SERVICES.map((s) => ({
    service: s,
    count: allPkgs.filter((p) => p.service === s).length,
    value: allPkgs.filter((p) => p.service === s).reduce((a, p) => a + p.paid, 0),
  }));
  const maxCount = Math.max(1, ...byService.map((x) => x.count));

  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    if (backupRange === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (backupRange === "week") {
      start.setDate(end.getDate() - 7);
    } else if (backupRange === "month") {
      start.setMonth(end.getMonth() - 1);
    }
    return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
  };

  const handleBackupToSupabase = async () => {
    setBackupLoading(true);
    setBackupMsg("");
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        setBackupMsg("✗ Error: Not authenticated");
        return;
      }

      const dateRange = getDateRange();
      const filteredBookings = bookings.filter((b) => {
        if (b.status !== "done" && b.status !== "cancelled") return false;
        return b.date >= dateRange.start && b.date <= dateRange.end;
      });

      // Prepare data for backup
      const backupData = {
        range: backupRange,
        dateRange,
        clients: clients.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone || "",
          soldBy: c.soldBy || "",
          packages: c.packages.length,
          totalPaid: c.packages.reduce((s, p) => s + p.paid, 0),
          packages_detail: c.packages,
          legacy_packages: c.legacy_packages || [],
        })),
        bookings: filteredBookings.map((b) => ({
          id: b.id,
          clientName: b.clientName,
          clientId: b.clientId,
          service: b.service,
          status: b.status,
          date: b.date,
          time: b.time,
          revenue: b.revenue || 0,
          therapist: b.therapist,
          room: b.room,
          isLegacy: b.isLegacy || false,
        })),
        summary: {
          totalClients: clients.length,
          sessionsDone: filteredBookings.filter((b) => b.status === "done").length,
          cancellations: filteredBookings.filter((b) => b.status === "cancelled").length,
          totalRevenue: filteredBookings.filter((b) => b.status === "done" && !b.isLegacy).reduce((s, b) => s + b.revenue, 0),
          backupDate: new Date().toISOString(),
        },
      };

      // Call edge function to save backup
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-data`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          backupType: backupRange,
          data: backupData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Backup failed");
      }

      const result = await response.json();
      setBackupMsg(`✓ Backup saved (${backupRange})`);
    } catch (error) {
      setBackupMsg("✗ Error: " + error.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const downloadBackup = (format) => {
    const dateRange = getDateRange();
    const filteredBookings = bookings.filter((b) => {
      if (b.status !== "done" && b.status !== "cancelled") return false;
      return b.date >= dateRange.start && b.date <= dateRange.end;
    });

    const backupData = {
      range: backupRange,
      dateRange,
      clients: clients.map((c) => ({
        name: c.name,
        phone: c.phone || "",
        soldBy: c.soldBy || "",
        packages: c.packages.length,
        totalPaid: c.packages.reduce((s, p) => s + p.paid, 0),
        legacy_packages: (c.legacy_packages || []).length,
      })),
      bookings: filteredBookings,
      summary: {
        totalClients: clients.length,
        sessionsDone: filteredBookings.filter((b) => b.status === "done").length,
        cancellations: filteredBookings.filter((b) => b.status === "cancelled").length,
        totalRevenue: filteredBookings.filter((b) => b.status === "done").reduce((s, b) => s + b.revenue, 0),
        backupDate: new Date().toLocaleString(),
      },
    };

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `backup_${backupRange}_${timestamp}`;

    if (format === "txt") {
      const text = JSON.stringify(backupData, null, 2);
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === "xlsx") {
      // Simple CSV export (Excel compatible)
      let csv = "BACKUP SUMMARY\n";
      csv += `Date: ${backupData.summary.backupDate}\n`;
      csv += `Range: ${backupRange}\n\n`;
      csv += "SUMMARY\n";
      csv += `Total Clients,${backupData.summary.totalClients}\n`;
      csv += `Sessions Done,${backupData.summary.sessionsDone}\n`;
      csv += `Cancellations,${backupData.summary.cancellations}\n`;
      csv += `Total Revenue,€${backupData.summary.totalRevenue.toFixed(2)}\n\n`;

      csv += "CLIENTS\n";
      csv += "Name,Phone,Sold By,Packages,Total Paid,Legacy Packages\n";
      backupData.clients.forEach((c) => {
        csv += `"${c.name}","${c.phone}","${c.soldBy}",${c.packages},€${c.totalPaid.toFixed(2)},${c.legacy_packages}\n`;
      });

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const cards = [
    { label: "PACKAGES SOLD (TOTAL)", value: totalPackages, icon: Package },
    { label: "PACKAGE VALUE (TOTAL)", value: fmtEuro(totalPackageValue), icon: Euro },
    { label: "SESSIONS DONE (TOTAL)", value: sessionsDone, icon: CheckCircle2 },
    { label: "CANCELLATIONS (TOTAL)", value: cancellations, icon: XCircle },
  ];

  return (
    <div className="fade">
      <h1 style={S.h1}>Overview</h1>
      <p style={S.sub}>Studio totals across all time</p>
      <div style={S.hr} />

      <div style={S.cardRow}>
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="card" style={S.statCard}>
              <div style={S.statTop}>
                <span style={S.statLabel}>{c.label}</span>
                <Icon size={18} color={GOLD} strokeWidth={1.6} />
              </div>
              <div style={S.statValue}>{c.value}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18, marginTop: 22 }}>
        <div className="card" style={S.panel}>
          <h2 style={S.h2}>Packages by service</h2>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            {byService.map((s) => (
              <div key={s.service}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                  <span style={{ color: "#d7d2c2" }}>{s.service}</span>
                  <span style={{ color: "#9b9b95" }}>{s.count} · {fmtEuro(s.value)}</span>
                </div>
                <div style={S.progressTrack}>
                  <div style={{ ...S.progressFill, width: `${(s.count / maxCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={S.panel}>
          <h2 style={S.h2}>At a glance</h2>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 0 }}>
            <KV k="Sessions sold (capacity)" v={totalSessionsSold} />
            <KV k="Sessions completed" v={sessionsDone} />
            <KV k="Upcoming bookings" v={upcoming} />
            <KV k="Cancellations" v={cancellations} />
            <KV k="Revenue earned" v={fmtEuro(totalRevenue)} gold />
            <KV k="Unredeemed value" v={fmtEuro(totalPackageValue - totalRevenue)} />
          </div>
        </div>
      </div>

      <div className="card" style={{ ...S.panel, marginTop: 18 }}>
        <h2 style={S.h2}>Data Backup</h2>
        <p style={{ color: "#8a8a83", fontSize: 13, marginTop: 10, lineHeight: 1.6 }}>
          Backup your data by date range. Backups stored in Supabase or download as TXT/CSV.
        </p>

        <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { id: "today", label: "Today" },
            { id: "week", label: "This week" },
            { id: "month", label: "This month" },
            { id: "all", label: "All time" },
          ].map((r) => (
            <button
              key={r.id}
              className="mini"
              onClick={() => setBackupRange(r.id)}
              style={{
                padding: "8px 12px",
                fontSize: 12,
                borderRadius: 6,
                border: `1px solid ${backupRange === r.id ? GOLD : "#2a2a26"}`,
                background: backupRange === r.id ? `${GOLD}22` : "transparent",
                color: backupRange === r.id ? GOLD : "#8a8a83",
                fontWeight: backupRange === r.id ? 600 : 500,
                cursor: "pointer",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="goldbtn"
            style={{ ...S.goldBtn }}
            onClick={handleBackupToSupabase}
            disabled={backupLoading}
          >
            {backupLoading ? "Saving..." : "Save to Supabase"}
          </button>
          <button
            className="mini"
            style={{
              padding: "10px 14px",
              fontSize: 13,
              borderRadius: 6,
              border: `1px solid ${GOLD}44`,
              background: `${GOLD}11`,
              color: GOLD,
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => downloadBackup("txt")}
          >
            Download TXT
          </button>
          <button
            className="mini"
            style={{
              padding: "10px 14px",
              fontSize: 13,
              borderRadius: 6,
              border: `1px solid ${GOLD}44`,
              background: `${GOLD}11`,
              color: GOLD,
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => downloadBackup("xlsx")}
          >
            Download CSV
          </button>
        </div>

        {backupMsg && (
          <div style={{ marginTop: 10, fontSize: 12, color: backupMsg.startsWith("✓") ? GOLD_LIGHT : "#ff6b6b", fontWeight: 500 }}>
            {backupMsg}
          </div>
        )}
      </div>
    </div>
  );
}

function KV({ k, v, gold }) {
  return (
    <div style={S.kvRow}>
      <span style={{ color: "#9b9b95", fontSize: 13.5 }}>{k}</span>
      <span style={{ color: gold ? GOLD_LIGHT : "#f1ead6", fontWeight: 600, fontSize: 14.5 }}>{v}</span>
    </div>
  );
}

/* ============================================================
   Revenue (per therapist + bonus)
   ============================================================ */
function Revenue({ bookings, clients }) {
  const done = bookings.filter((b) => b.status === "done");

  const rows = THERAPISTS.map((t) => {
    // Sessions this therapist performed → revenue earned + bonus
    const mine = done.filter((b) => b.therapist === t.name);
    const regularSessions = mine.filter((b) => !b.isLegacy).length;
    const sessions = mine.length;
    const earned = mine.reduce((s, b) => s + b.revenue, 0);
    const regularBonus = earned * THERAPIST_BONUS_RATE;

    // Legacy sessions (historical sessions not counted in revenue but counted for sessions total)
    const legacySessions = clients.flatMap((c) => c.legacy_packages || [])
      .filter((p) => p.therapist === t.name)
      .reduce((s, p) => s + p.sessions, 0);

    // Legacy bonus: 30% of per-session cost for sessions used only
    const legacyBonus = clients.flatMap((c) => c.legacy_packages || [])
      .filter((p) => p.therapist === t.name)
      .reduce((s, p) => {
        const sessionsUsed = p.sessionsUsed || 0;
        const totalSessions = Number(p.sessions) || 1;
        const perSession = Number(p.paid) > 0 ? Number(p.paid) / totalSessions : 0;
        const usedBonus = sessionsUsed * perSession * THERAPIST_BONUS_RATE;
        return s + usedBonus;
      }, 0);

    // Count of each service performed
    const byService = {};
    SERVICES.forEach((s) => { byService[s] = mine.filter((b) => b.service === s).length; });
    // Packages this therapist sold (a client's packages are credited to the client's seller)
    const soldClients = clients.filter((c) => c.soldBy === t.name);
    const soldPkgs = soldClients.flatMap((c) => c.packages || []);
    const packagesSold = soldPkgs.length;
    const soldValue = soldPkgs.reduce((s, p) => s + p.paid, 0);
    return { ...t, regularSessions, sessions, legacySessions, earned, regularBonus, legacyBonus, bonus: regularBonus + legacyBonus, byService, packagesSold, soldValue };
  });

  const totalEarned = rows.reduce((s, r) => s + r.earned, 0);
  const totalBonus = rows.reduce((s, r) => s + r.bonus, 0);
  const totalSoldValue = rows.reduce((s, r) => s + r.soldValue, 0);
  const maxEarned = Math.max(1, ...rows.map((r) => r.earned));
  const maxSold = Math.max(1, ...rows.map((r) => r.soldValue));

  return (
    <div className="fade">
      <h1 style={S.h1}>My revenue</h1>
      <p style={S.sub}>Per physiotherapist · bonus = {Math.round(THERAPIST_BONUS_RATE * 100)}% of revenue from completed sessions</p>
      <div style={S.hr} />

      <div style={S.cardRow}>
        <div className="card" style={S.statCard}>
          <div style={S.statTop}><span style={S.statLabel}>PACKAGES SOLD (€)</span><TrendingUp size={18} color={GOLD} /></div>
          <div style={S.statValue}>{fmtEuro(totalSoldValue)}</div>
        </div>
        <div className="card" style={S.statCard}>
          <div style={S.statTop}><span style={S.statLabel}>REVENUE EARNED</span><Euro size={18} color={GOLD} /></div>
          <div style={S.statValue}>{fmtEuro(totalEarned)}</div>
        </div>
        <div className="card" style={S.statCard}>
          <div style={S.statTop}><span style={S.statLabel}>TOTAL BONUS</span><Award size={18} color={GOLD} /></div>
          <div style={S.statValue}>{fmtEuro(totalBonus)}</div>
        </div>
        <div className="card" style={S.statCard}>
          <div style={S.statTop}><span style={S.statLabel}>SESSIONS DONE</span><CheckCircle2 size={18} color={GOLD} /></div>
          <div style={S.statValue}>{done.length}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 22 }}>
        {/* Sessions performed + bonus */}
        <div className="card" style={S.panel}>
          <h2 style={S.h2}>Sessions & bonus</h2>
          <p style={{ color: "#8a8a83", fontSize: 12.5, marginTop: 4 }}>Each session = 30% bonus</p>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {rows.map((r) => {
              const legacyCount = clients.flatMap((c) => c.legacy_packages || [])
                .filter((p) => p.therapist === r.name)
                .reduce((s, p) => s + (p.sessionsUsed || 0), 0);
              return (
                <div key={r.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ ...S.dot, background: r.color }} />
                      <span style={{ color: "#f1ead6", fontWeight: 600, fontSize: 15 }}>{r.name}</span>
                    </div>
                    <span style={{ fontSize: 13, color: "#9b9b95" }}>Bonus <b style={{ color: GOLD_LIGHT }}>{fmtEuro(r.bonus)}</b></span>
                  </div>
                  <div style={{ fontSize: 12, color: "#a8a8a0", marginBottom: 6 }}>
                    {r.regularSessions} sessions × {fmtEuro(r.earned > 0 ? r.earned / r.regularSessions : 0)}/session × 30% = {fmtEuro(r.regularBonus)}{r.legacyBonus > 0 && ` + legacy ${fmtEuro(r.legacyBonus)}`}
                  </div>
                  <div style={{ fontSize: 11.5, color: GOLD_LIGHT, marginBottom: 6, fontWeight: 600 }}>
                    Total bonus: {fmtEuro(r.earned + (r.legacyBonus > 0 ? r.legacyBonus / 0.3 : 0))}
                  </div>
                  <div style={S.progressTrack}>
                    <div style={{ ...S.progressFill, width: `${(r.earned / maxEarned) * 100}%`, background: `linear-gradient(90deg, ${r.color}aa, ${r.color})` }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: "#8a8a83", marginTop: 4 }}>
                    Revenue earned {fmtEuro(r.earned)}{legacyCount > 0 && ` · ${legacyCount} legacy sessions`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Packages sold */}
        <div className="card" style={S.panel}>
          <h2 style={S.h2}>Packages sold</h2>
          <p style={{ color: "#8a8a83", fontSize: 12.5, marginTop: 4 }}>Credited to whoever sold the package</p>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {rows.map((r) => (
              <div key={r.name}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ ...S.dot, background: r.color }} />
                    <span style={{ color: "#f1ead6", fontWeight: 600, fontSize: 15 }}>{r.name}</span>
                    <span style={{ color: "#8a8a83", fontSize: 12.5 }}>· {r.packagesSold} packages</span>
                  </div>
                  <span style={{ fontSize: 13, color: "#9b9b95" }}>Sold <b style={{ color: "#f1ead6" }}>{fmtEuro(r.soldValue)}</b></span>
                </div>
                <div style={S.progressTrack}>
                  <div style={{ ...S.progressFill, width: `${(r.soldValue / maxSold) * 100}%`, background: `linear-gradient(90deg, ${r.color}aa, ${r.color})` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Services performed per therapist */}
      <div className="card" style={{ ...S.panel, marginTop: 18 }}>
        <h2 style={S.h2}>Services performed</h2>
        <p style={{ color: "#8a8a83", fontSize: 12.5, marginTop: 4 }}>How many of each service every therapist completed</p>
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table style={S.svcTable}>
            <thead>
              <tr>
                <th style={{ ...S.svcTh, textAlign: "left" }}>Therapist</th>
                {SERVICES.map((s) => <th key={s} style={S.svcTh}>{s}</th>)}
                <th style={{ ...S.svcTh, color: GOLD_LIGHT }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td style={{ ...S.svcTd, textAlign: "left" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ ...S.dot, width: 9, height: 9, background: r.color }} />
                      <span style={{ color: "#f1ead6", fontWeight: 600 }}>{r.name}</span>
                    </span>
                  </td>
                  {SERVICES.map((s) => (
                    <td key={s} style={S.svcTd}>
                      {r.byService[s] > 0
                        ? <span style={{ ...S.svcCount, borderColor: r.color + "55", color: "#f1ead6" }}>{r.byService[s]}</span>
                        : <span style={{ color: "#4a4a44" }}>—</span>}
                    </td>
                  ))}
                  <td style={{ ...S.svcTd, color: GOLD_LIGHT, fontWeight: 700 }}>{r.sessions}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...S.svcTd, textAlign: "left", color: "#9b9b95", fontWeight: 600, borderTop: "1px solid #2a2722" }}>All</td>
                {SERVICES.map((s) => (
                  <td key={s} style={{ ...S.svcTd, color: "#cfcfc8", borderTop: "1px solid #2a2722" }}>
                    {rows.reduce((sum, r) => sum + r.byService[s], 0) || "—"}
                  </td>
                ))}
                <td style={{ ...S.svcTd, color: GOLD_LIGHT, fontWeight: 700, borderTop: "1px solid #2a2722" }}>{done.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {done.length === 0 && clients.length === 0 && <p style={{ color: "#8a8a83", marginTop: 18 }}>Add clients and complete sessions to start tracking sales & bonuses.</p>}
    </div>
  );
}

/* ============================================================
   History
   ============================================================ */
const HISTORY_META = {
  client_added: { label: "Client added", color: "#4ade80" },
  client_edited: { label: "Client edited", color: "#60a5fa" },
  client_deleted: { label: "Client deleted", color: "#f87171" },
  booking_added: { label: "Booked", color: GOLD },
  session_done: { label: "Session done", color: "#4ade80" },
  booking_cancelled: { label: "Cancelled", color: "#f87171" },
  booking_moved: { label: "Moved", color: "#60a5fa" },
  booking_deleted: { label: "Removed", color: "#f87171" },
};

function History({ history }) {
  const [filter, setFilter] = useState("all");
  const filters = [
    { id: "all", label: "All" },
    { id: "client", label: "Clients" },
    { id: "booking", label: "Bookings" },
    { id: "cancel", label: "Cancellations" },
  ];
  const match = (h) => {
    if (filter === "all") return true;
    if (filter === "client") return h.type.startsWith("client");
    if (filter === "booking") return h.type === "booking_added" || h.type === "session_done" || h.type === "booking_moved";
    if (filter === "cancel") return h.type === "booking_cancelled";
    return true;
  };
  const list = history.filter(match);

  return (
    <div className="fade">
      <h1 style={S.h1}>History</h1>
      <p style={S.sub}>Every activity — additions, bookings, cancellations & moves</p>
      <div style={S.hr} />

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {filters.map((f) => (
          <button key={f.id} className="mini" onClick={() => setFilter(f.id)}
            style={{ ...S.filterChip, ...(filter === f.id ? S.filterChipActive : {}) }}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="card" style={S.panel}>
        {list.length === 0 ? (
          <p style={{ color: "#8a8a83" }}>No activity yet.</p>
        ) : (
          <div style={S.timeline}>
            {list.map((h) => {
              const meta = HISTORY_META[h.type] || { label: h.type, color: GOLD };
              return (
                <div key={h.id} style={S.timelineRow}>
                  <div style={{ ...S.timelineDot, background: meta.color }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                      <span style={{ ...S.timelineTag, color: meta.color, borderColor: meta.color + "44" }}>{meta.label}</span>
                      <span style={{ fontSize: 12, color: "#6f6f68", whiteSpace: "nowrap" }}>{niceDateTime(h.ts)}</span>
                    </div>
                    <div style={{ color: "#d7d2c2", fontSize: 13.5, marginTop: 5 }}>{h.message}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Shared UI bits
   ============================================================ */
function Modal({ title, children, onClose }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div className="modal" style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <h3 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 24, color: "#f1ead6", margin: 0 }}>{title}</h3>
          <button className="iconbtn" style={S.iconBtn} onClick={onClose}><X size={18} color="#9b9b95" /></button>
        </div>
        <div style={{ marginTop: 6 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label style={S.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

/* ============================================================
   Styles
   ============================================================ */
const S = {
  app: { display: "flex", flexDirection: "row", minHeight: "100vh", background: "#0c0b0a", color: "#e9e4d6", fontFamily: "'Outfit', sans-serif" },
  loginCard: { background: "linear-gradient(160deg, #16140f, #100f0d)", border: "1px solid #25221c", borderRadius: 18, padding: 32, width: "100%", maxWidth: 400, boxShadow: "0 30px 80px rgba(0,0,0,0.6)" },
  loginHeader: { textAlign: "center", marginBottom: 8 },
  sidebar: { width: 248, minWidth: 248, background: "#100f0d", borderRight: "1px solid #211f1b", display: "flex", flexDirection: "column", padding: "0 0 18px" },
  brand: { padding: "26px 22px 18px" },
  brandName: { fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: GOLD, letterSpacing: 0.3, lineHeight: 1 },
  brandSub: { fontSize: 11, letterSpacing: 3, color: "#7d7a70", marginTop: 8 },
  navDivider: { height: 1, background: "#211f1b", margin: "0 0 14px" },
  nav: { display: "flex", flexDirection: "column", gap: 4, padding: "0 14px" },
  navBtn: { display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", fontSize: 14.5, fontFamily: "inherit", textAlign: "left", transition: "all .18s" },
  navBtnActive: { background: "linear-gradient(90deg, rgba(201,162,39,0.16), rgba(201,162,39,0.04))", boxShadow: "inset 0 0 0 1px rgba(201,162,39,0.3)" },
  sideFoot: { marginTop: "auto", padding: "16px 22px 0" },

  main: { flex: 1, padding: "clamp(12px, 5vw, 38px)", overflowY: "auto", maxHeight: "100vh" },
  h1: { fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(24px, 8vw, 38px)", fontWeight: 600, color: "#f3eedd", margin: 0, lineHeight: 1.05 },
  sub: { color: "#9b9b95", marginTop: 6, fontSize: 15 },
  hr: { height: 1, background: "#211f1b", margin: "20px 0 24px" },
  h2: { fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, color: "#f1ead6", margin: 0 },

  pageHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-end" },

  cardRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 },
  statCard: { background: "linear-gradient(160deg, #16140f, #100f0d)", border: "1px solid #25221c", borderRadius: 16, padding: "20px 20px 22px", transition: "transform .2s, border-color .2s" },
  statTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  statLabel: { fontSize: 11, letterSpacing: 1.2, color: "#8a8a83", fontWeight: 600 },
  statValue: { fontFamily: "'Cormorant Garamond', serif", fontSize: 34, color: GOLD_LIGHT, marginTop: 14, fontWeight: 600 },

  panel: { background: "linear-gradient(160deg, #14130f, #100f0d)", border: "1px solid #25221c", borderRadius: 18, padding: 26 },

  todayRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 16px", background: "#13110d", border: "1px solid #221f1a", borderRadius: 12 },
  dot: { width: 11, height: 11, borderRadius: "50%", display: "inline-block", flexShrink: 0 },
  badgeDone: { fontSize: 12, color: "#4ade80", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", padding: "4px 10px", borderRadius: 20 },
  badgeDoneSm: { fontSize: 10, color: "#4ade80", background: "rgba(74,222,128,0.12)", padding: "2px 7px", borderRadius: 12 },

  goldBtn: { display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #d9b441, #b8901f)", color: "#1a1505", border: "none", padding: "10px 18px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(201,162,39,0.25)" },
  miniGold: { background: "linear-gradient(135deg, #d9b441, #b8901f)", color: "#1a1505", border: "none", padding: "6px 12px", borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" },
  miniGhost: { background: "transparent", color: "#b6b6ad", border: "1px solid #322e26", padding: "6px 12px", borderRadius: 8, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" },

  clientGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16 },
  clientCard: { background: "linear-gradient(160deg, #16140f, #100f0d)", border: "1px solid #25221c", borderRadius: 16, padding: 20 },
  chip: { display: "inline-block", fontSize: 12, color: GOLD_LIGHT, background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.25)", padding: "4px 12px", borderRadius: 20 },
  progressTrack: { height: 7, background: "#211f1a", borderRadius: 10, overflow: "hidden" },
  progressFill: { height: "100%", background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`, borderRadius: 10, transition: "width .4s" },
  clientStats: { display: "flex", justifyContent: "space-between", marginTop: 16, paddingTop: 14, borderTop: "1px solid #221f1a" },
  pkgBlock: { background: "#13110d", border: "1px solid #221f1a", borderRadius: 12, padding: "12px 14px" },
  pkgEditRow: { background: "#0e0d0b", border: "1px solid #221f1a", borderRadius: 12, padding: 14 },
  addPkgBtn: { display: "inline-flex", alignItems: "center", gap: 7, background: "transparent", border: "1px dashed #3a362d", color: GOLD_LIGHT, borderRadius: 9, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginTop: 10, width: "100%", justifyContent: "center" },
  pkgSelectRow: { display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid", borderRadius: 9, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", width: "100%" },
  dangerBtn: { flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, background: "linear-gradient(135deg, #d9484f, #b8272e)", color: "#fff", border: "none", padding: "11px 0", borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" },
  miniLabel: { fontSize: 10, letterSpacing: 0.8, color: "#7d7a70", fontWeight: 600 },
  miniValue: { fontSize: 15, color: "#f1ead6", marginTop: 3, fontWeight: 600 },
  iconBtn: { background: "transparent", border: "1px solid #2a2722", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },

  dateNav: { display: "flex", alignItems: "center", gap: 10 },
  navArrow: { background: "#16140f", border: "1px solid #2a2722", borderRadius: 9, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },

  gridScroll: { overflowX: "auto" },
  gridRow: { display: "grid", gridTemplateColumns: "70px repeat(4, minmax(150px, 1fr))", borderBottom: "1px solid #1c1a16" },
  gridHeadRow: { position: "sticky", top: 0, background: "#15130f", zIndex: 2 },
  gridHeadCell: { fontSize: 12, letterSpacing: 1, color: "#8a8a83", fontWeight: 700, textTransform: "uppercase" },
  gridTimeCell: { padding: "10px 12px", fontSize: 13, color: "#9b9b95", borderRight: "1px solid #1c1a16", display: "flex", alignItems: "flex-start" },
  gridCell: { padding: 6, borderRight: "1px solid #1c1a16", minHeight: 58 },
  emptySlot: { width: "100%", height: "100%", minHeight: 46, background: "transparent", border: "1px dashed #2a2722", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" },
  busyCell: { width: "100%", minHeight: 46, background: "repeating-linear-gradient(45deg, #131109, #131109 6px, #16140d 6px, #16140d 12px)", border: "1px solid #221f1a", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 10.5, color: "#7d7a70" },
  slotCard: { border: "1px solid", borderLeft: "3px solid", borderRadius: 8, padding: "8px 10px" },
  slotMini: { background: "#1d1a15", border: "1px solid #322e26", color: "#cfcfc8", borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" },
  slotMiniGold: { background: "linear-gradient(135deg, #d9b441, #b8901f)", border: "none", color: "#1a1505", borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },

  svcTable: { width: "100%", borderCollapse: "collapse", minWidth: 560 },
  svcTh: { fontSize: 11, letterSpacing: 0.5, color: "#8a8a83", fontWeight: 700, textAlign: "center", padding: "0 10px 12px", textTransform: "uppercase", whiteSpace: "nowrap" },
  svcTd: { fontSize: 14, color: "#cfcfc8", textAlign: "center", padding: "11px 10px", borderTop: "1px solid #1c1a16" },
  svcCount: { display: "inline-flex", minWidth: 26, justifyContent: "center", border: "1px solid", borderRadius: 14, padding: "2px 9px", fontWeight: 700, fontSize: 13 },

  kvRow: { display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid #1c1a16" },

  overlay: { position: "fixed", inset: 0, background: "rgba(6,5,4,0.72)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 },
  modal: { width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", background: "linear-gradient(160deg, #17150f, #100f0d)", border: "1px solid #2c281f", borderRadius: 18, padding: 24, boxShadow: "0 30px 80px rgba(0,0,0,0.6)" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  fieldLabel: { display: "block", fontSize: 12, letterSpacing: 0.5, color: "#9b9b95", marginBottom: 6, fontWeight: 600 },
  input: { width: "100%", background: "#0e0d0b", border: "1px solid #2c281f", borderRadius: 9, padding: "10px 12px", color: "#f1ead6", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  calcBox: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(201,162,39,0.07)", border: "1px solid rgba(201,162,39,0.2)", borderRadius: 10, padding: "12px 14px", marginTop: 4 },
  errBox: { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.35)", color: "#fca5a5", borderRadius: 9, padding: "9px 12px", fontSize: 13, marginTop: 4 },
  therChip: { display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid", borderRadius: 9, padding: "7px 12px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" },
  roomChip: { border: "1px solid", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontFamily: "inherit", flex: 1 },

  filterChip: { background: "transparent", border: "1px solid #2a2722", color: "#9b9b95", borderRadius: 20, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" },
  filterChipActive: { background: "rgba(201,162,39,0.12)", borderColor: "rgba(201,162,39,0.4)", color: GOLD_LIGHT },

  timeline: { display: "flex", flexDirection: "column", gap: 0 },
  timelineRow: { display: "flex", gap: 16, padding: "14px 0", borderBottom: "1px solid #1c1a16", position: "relative" },
  timelineDot: { width: 10, height: 10, borderRadius: "50%", marginTop: 4, flexShrink: 0, boxShadow: "0 0 0 4px rgba(255,255,255,0.02)" },
  timelineTag: { fontSize: 11.5, fontWeight: 700, border: "1px solid", padding: "2px 9px", borderRadius: 14, letterSpacing: 0.3 },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap');
* { box-sizing: border-box; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: #0c0b0a; }
::-webkit-scrollbar-thumb { background: #2a2722; border-radius: 6px; }
::-webkit-scrollbar-thumb:hover { background: #3a362d; }
.navbtn:hover { background: rgba(255,255,255,0.03) !important; }
.card:hover { border-color: #2f2b22 !important; }
.statCard:hover { transform: translateY(-2px); }
.goldbtn:hover { filter: brightness(1.08); transform: translateY(-1px); }
.goldbtn:active { transform: translateY(0); }
.iconbtn:hover { border-color: #3a362d !important; background: rgba(255,255,255,0.03) !important; }
.emptyslot:hover { border-color: ${GOLD} !important; background: rgba(201,162,39,0.06) !important; }
.mini:hover { filter: brightness(1.1); }
.inp:focus { border-color: ${GOLD} !important; box-shadow: 0 0 0 3px rgba(201,162,39,0.12); }
.fade { animation: fade .35s ease; }
@keyframes fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7) sepia(1) saturate(3) hue-rotate(5deg); cursor: pointer; }
select.inp option { background: #14130f; }

@media (max-width: 1200px) {
  [style*="gridTemplateColumns: repeat(4"]  { grid-template-columns: repeat(2, 1fr) !important; }
  [style*="gridTemplateColumns: 1.3fr 1fr"] { grid-template-columns: 1fr !important; }
  [style*="gridTemplateColumns: 1fr 1fr"]   { grid-template-columns: 1fr !important; }
}

@media (max-width: 768px) {
  body { font-size: 14px; }
  .app { flex-direction: column !important; }

  /* Hide desktop sidebar */
  .desktop-sidebar {
    display: none !important;
  }

  /* Show mobile sidebar */
  .mobile-sidebar {
    display: flex !important;
  }

  .mobile-menu-overlay {
    display: block !important;
  }

  /* Show mobile header */
  .mobile-header {
    display: flex !important;
  }

  main {
    padding-top: 70px !important;
    max-height: calc(100vh - 60px) !important;
  }

  h1 { font-size: 26px !important; }
  h2 { font-size: 18px !important; }
  .pageHead { flex-direction: column; align-items: flex-start; gap: 12px; }
  .goldbtn { width: 100%; padding: 10px 14px !important; font-size: 13px; }

  /* Hide tables on mobile, show mobile cards */
  table { display: none !important; }
  .clients-table-wrapper { display: none !important; }
  .clients-mobile-cards { display: grid !important; }

  th, td { padding: 8px 6px !important; }
  [style*="gridTemplateColumns"] { grid-template-columns: 1fr !important; }
  .card { padding: 16px !important; }
  .modal { max-width: 95vw !important; max-height: 90vh !important; }
  .overlay { padding: 12px !important; }
}

@media (max-width: 480px) {
  main { padding: 12px !important; }
  h1 { font-size: 22px !important; }
  h2 { font-size: 16px !important; }
  .card { padding: 12px !important; }
  .statCard { padding: 14px !important; }
  .statValue { font-size: 26px !important; }
  button { font-size: 12px; padding: 8px 12px !important; }
  table { font-size: 11px; }
  th, td { padding: 6px 4px !important; }
}
`;
