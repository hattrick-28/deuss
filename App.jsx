import React, { useState, useEffect } from "react";
import { LayoutGrid, Calendar as CalIcon, Users, Euro, History as HistoryIcon, CircleCheck as CheckCircle2, Circle as XCircle, CalendarDays, Plus, Trash2, Clock, MapPin, TrendingUp, Award, X, ChevronLeft, ChevronRight, CreditCard as Edit3, Package, LogOut, LogIn } from "lucide-react";
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

const ROOMS = ["Room 1", "Room 2", "Room 3"];
const ROOM_COUNT = ROOMS.length;
const THERAPIST_BONUS_RATE = 0.30; // 30% profit to physiotherapist
const SESSION_MIN = 60; // each session lasts 60 minutes

// Hourly grid rows shown in the calendar (08:00 .. 20:00)
const HOURS = [];
for (let h = 8; h <= 20; h++) HOURS.push(`${String(h).padStart(2, "0")}:00`);

// Bookable start times in 30-min steps (08:00 .. 19:30 so a 60-min session ends by 20:30)
const SLOTS = [];
for (let m = 8 * 60; m <= 19 * 60 + 30; m += 30) {
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
const todayISO = () => new Date().toISOString().slice(0, 10);
const niceDate = (iso) => {
  const d = new Date(iso + "T00:00:00");
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
  };
}

/* ============================================================
   Root
   ============================================================ */
export default function App() {
  const [tab, setTab] = useState("dashboard");
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
    }).eq("id", id);
    if (error) { console.error(error); return; }

    setClients((cs) => cs.map((c) => c.id === id
      ? { ...c, name: data.name, phone: data.phone, soldBy: data.soldBy, packages: newPackages }
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
    const pkg = client?.packages.find((p) => p.id === data.packageId);
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
      revenue: pkg?.perSession || 0,
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
    // increment sessions used on the matching package
    const client = clients.find((c) => c.id === done.clientId);
    if (client) {
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
    if (!counter) {
      const cl = clients.find((x) => x.id === done.clientId);
      const p = cl?.packages.find((pp) => pp.id === done.packageId);
      if (p) counter = `${Math.min(p.sessions, p.sessionsUsed + 1)}/${p.sessions}`;
    }
    const bonus = (done.revenue || 0) * THERAPIST_BONUS_RATE;
    log("session_done",
      `Session completed: ${done.clientName} (${done.service}) with ${done.therapist} — session ${counter} · bonus ${fmtEuro(bonus)} (${fmtEuro(done.revenue)})`);
  };

  const cancelBooking = async (id) => {
    const c = bookings.find((x) => x.id === id);
    if (!c) return;
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) { console.error(error); return; }
    setBookings((b) => b.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x)));
    log("booking_cancelled",
      `Cancelled ${c.clientName} with ${c.therapist} • ${niceDate(c.date)} ${c.time}`);
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
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) { console.error(error); return; }
    setBookings((b) => b.filter((x) => x.id !== id));
    if (bk) log("booking_deleted", `Removed booking for ${bk.clientName} • ${niceDate(bk.date)} ${bk.time}`);
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

      {/* Sidebar */}
      <aside style={S.sidebar}>
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
            {ROOM_COUNT} rooms · 08:00–20:00<br />Bonus {Math.round(THERAPIST_BONUS_RATE * 100)}%
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={S.main}>
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
  const revenue = bookings.filter((b) => b.status === "done" && inMonth(b.date)).reduce((s, b) => s + b.revenue, 0);
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
  const [formState, setFormState] = useState(null); // null | { mode: "add" } | { mode: "edit", client }
  const [confirmDel, setConfirmDel] = useState(null); // client to delete

  return (
    <div className="fade">
      <div style={S.pageHead}>
        <div>
          <h1 style={S.h1}>Clients</h1>
          <p style={S.sub}>Multiple packages per client · edits are saved to History</p>
        </div>
        <button className="goldbtn" style={S.goldBtn} onClick={() => setFormState({ mode: "add" })}>
          <Plus size={16} /> Add client
        </button>
      </div>
      <div style={S.hr} />

      {clients.length === 0 ? (
        <div className="card" style={S.panel}><p style={{ color: "#8a8a83" }}>No clients yet. Add your first one above.</p></div>
      ) : (
        <div style={S.clientGrid}>
          {clients.map((c) => {
            const totalPaid = c.packages.reduce((s, p) => s + p.paid, 0);
            return (
              <div key={c.id} className="card" style={S.clientCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 18, color: "#f1ead6", fontFamily: "Cormorant Garamond, serif", fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: "#9b9b95", marginTop: 2 }}>{c.phone || "—"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 7 }}>
                    <button className="iconbtn" style={S.iconBtn} onClick={() => setFormState({ mode: "edit", client: c })} title="Edit">
                      <Edit3 size={14} color="#8a8a83" />
                    </button>
                    <button className="iconbtn" style={S.iconBtn} onClick={() => setConfirmDel(c)} title="Delete">
                      <Trash2 size={15} color="#8a8a83" />
                    </button>
                  </div>
                </div>

                {c.soldBy && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ ...S.chip, color: therapistColor(c.soldBy), background: therapistSoft(c.soldBy), borderColor: therapistColor(c.soldBy) + "55", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ ...S.dot, width: 8, height: 8, background: therapistColor(c.soldBy) }} /> Sold by {c.soldBy}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                  {c.packages.map((p) => {
                    const remaining = p.sessions - p.sessionsUsed;
                    const pct = p.sessions > 0 ? (p.sessionsUsed / p.sessions) * 100 : 0;
                    return (
                      <div key={p.id} style={S.pkgBlock}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 13.5, color: "#e9e4d6", fontWeight: 600 }}>{p.service}</span>
                          <span style={{ color: GOLD_LIGHT, fontWeight: 700, fontSize: 14 }}>{p.sessionsUsed}/{p.sessions}</span>
                        </div>
                        <div style={S.progressTrack}>
                          <div style={{ ...S.progressFill, width: `${pct}%` }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#8a8a83", marginTop: 6 }}>
                          <span>{fmtEuro(p.paid)} · {fmtEuro(p.perSession)}/session</span>
                          <span>{remaining} left</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, paddingTop: 14, borderTop: "1px solid #221f1a" }}>
                  <span style={S.miniLabel}>TOTAL PAID</span>
                  <span style={{ color: "#f1ead6", fontWeight: 700, fontSize: 15 }}>{fmtEuro(totalPaid)}</span>
                </div>
              </div>
            );
          })}
        </div>
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
  const isEdit = mode === "edit";

  const [name, setName] = useState(isEdit ? client.name : "");
  const [phone, setPhone] = useState(isEdit ? (client.phone || "") : "");
  const [soldBy, setSoldBy] = useState(isEdit ? client.soldBy : THERAPISTS[0].name);
  const [pkgs, setPkgs] = useState(
    isEdit
      ? client.packages.map((p) => ({ key: p.id, id: p.id, service: p.service, sessions: String(p.sessions), paid: String(p.paid), sessionsUsed: p.sessionsUsed }))
      : [blankPkg()]
  );

  const updatePkg = (key, field, val) =>
    setPkgs((ps) => ps.map((p) => (p.key === key ? { ...p, [field]: val } : p)));
  const addPkgRow = () => setPkgs((ps) => [...ps, blankPkg()]);
  const removePkgRow = (key) => setPkgs((ps) => (ps.length > 1 ? ps.filter((p) => p.key !== key) : ps));

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
    if (!name.trim() || validPkgs.length === 0) return;
    onSubmit({
      name: name.trim(),
      phone,
      soldBy,
      packages: validPkgs.map((p) => ({ id: p.id || undefined, service: p.service, sessions: p.sessions, paid: p.paid })),
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
          <p style={S.sub}>{ROOM_COUNT} rooms · 08:00–20:00 · 30-min slots · 1-hour sessions</p>
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
  const [f, setF] = useState({
    clientId: firstClient?.id || "",
    packageId: firstClient?.packages?.[0]?.id || "",
    therapist: THERAPISTS[0].name,
    room: preset?.room || ROOMS[0],
    date,
    time: preset?.time || HOURS[0],
  });
  const [err, setErr] = useState("");

  const client = clients.find((c) => c.id === f.clientId);
  const clientPkgs = client?.packages || [];
  const selectedPkg = clientPkgs.find((p) => p.id === f.packageId);

  const onClientChange = (id) => {
    const c = clients.find((x) => x.id === id);
    setF({ ...f, clientId: id, packageId: c?.packages?.[0]?.id || "" });
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
        {clientPkgs.length === 0 ? (
          <div style={{ ...S.input, color: "#8a8a83" }}>No packages</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {clientPkgs.map((p) => {
              const booked = bookings.filter((b) => b.packageId === p.id && b.status === "booked").length;
              const left = p.sessions - p.sessionsUsed - booked;
              const active = f.packageId === p.id;
              return (
                <button key={p.id} className="mini"
                  onClick={() => setF({ ...f, packageId: p.id })}
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
    const sessions = mine.length;
    const earned = mine.reduce((s, b) => s + b.revenue, 0);
    const bonus = earned * THERAPIST_BONUS_RATE;
    // Count of each service performed
    const byService = {};
    SERVICES.forEach((s) => { byService[s] = mine.filter((b) => b.service === s).length; });
    // Packages this therapist sold (a client's packages are credited to the client's seller)
    const soldClients = clients.filter((c) => c.soldBy === t.name);
    const soldPkgs = soldClients.flatMap((c) => c.packages || []);
    const packagesSold = soldPkgs.length;
    const soldValue = soldPkgs.reduce((s, p) => s + p.paid, 0);
    return { ...t, sessions, earned, bonus, byService, packagesSold, soldValue };
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
          <p style={{ color: "#8a8a83", fontSize: 12.5, marginTop: 4 }}>From sessions each therapist performed</p>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {rows.map((r) => (
              <div key={r.name}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ ...S.dot, background: r.color }} />
                    <span style={{ color: "#f1ead6", fontWeight: 600, fontSize: 15 }}>{r.name}</span>
                    <span style={{ color: "#8a8a83", fontSize: 12.5 }}>· {r.sessions} sessions</span>
                  </div>
                  <span style={{ fontSize: 13, color: "#9b9b95" }}>Bonus <b style={{ color: GOLD_LIGHT }}>{fmtEuro(r.bonus)}</b></span>
                </div>
                <div style={S.progressTrack}>
                  <div style={{ ...S.progressFill, width: `${(r.earned / maxEarned) * 100}%`, background: `linear-gradient(90deg, ${r.color}aa, ${r.color})` }} />
                </div>
                <div style={{ fontSize: 11.5, color: "#8a8a83", marginTop: 4 }}>Earned {fmtEuro(r.earned)}</div>
              </div>
            ))}
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
  app: { display: "flex", minHeight: "100vh", background: "#0c0b0a", color: "#e9e4d6", fontFamily: "'Outfit', sans-serif" },
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

  main: { flex: 1, padding: "30px 38px", overflowY: "auto", maxHeight: "100vh" },
  h1: { fontFamily: "'Cormorant Garamond', serif", fontSize: 38, fontWeight: 600, color: "#f3eedd", margin: 0, lineHeight: 1.05 },
  sub: { color: "#9b9b95", marginTop: 6, fontSize: 15 },
  hr: { height: 1, background: "#211f1b", margin: "20px 0 24px" },
  h2: { fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, color: "#f1ead6", margin: 0 },

  pageHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-end" },

  cardRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 },
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
  gridRow: { display: "grid", gridTemplateColumns: "70px repeat(3, minmax(150px, 1fr))", borderBottom: "1px solid #1c1a16" },
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
  modal: { width: "100%", maxWidth: 460, background: "linear-gradient(160deg, #17150f, #100f0d)", border: "1px solid #2c281f", borderRadius: 18, padding: 24, boxShadow: "0 30px 80px rgba(0,0,0,0.6)" },
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
`;
