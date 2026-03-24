import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, signInWithGoogle, signOut } from "../../services/supabase/auth";
import { getProfile } from "../../services/supabase/profiles";
import { getRooms, createRoom, joinRoom, deleteRoom } from "../../services/supabase/teams";
import { getMembers } from "../../services/supabase/teams";
import Navbar from "../../components/Navbar/Navbar";
import TeamLeftNav from "./components/TeamLeftNav";
import TeamDashboard from "./components/TeamDashboard";
import AdminPanel from "./components/AdminPanel";
import ManageTeam from "./components/ManageTeam";
import TeamChat from "./components/TeamChat";
import TeamAiBot from "./components/TeamAiBot";
import TeamManageTransactions from "./components/TeamManageTransactions";
import "./TeamTracking.css";

function TeamTracking() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState([]);

  // Create room modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Join room modal
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinDept, setJoinDept] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    async function init() {
      const { session: s } = await getSession();
      if (!s) { navigate("/"); return; }
      setSession(s);
      const { profile: p } = await getProfile(s.user.id);
      setProfile(p);
      const { rooms: r } = await getRooms();
      setRooms(r);
      setLoading(false);
    }
    init();
  }, [navigate]);

  useEffect(() => {
    if (!selectedRoom || !session) return;
    setIsAdmin(selectedRoom.admin_id === session.user.id);
    getMembers(selectedRoom.id).then(({ members: m }) => setMembers(m));
  }, [selectedRoom, session]);

  async function handleLogout() {
    await signOut();
    navigate("/");
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const { room, error } = await createRoom({ name: newName.trim(), description: newDesc.trim() || null });
    setCreating(false);
    if (!error && room) {
      setRooms((prev) => [room, ...prev]);
      setSelectedRoom(room);
      setActiveTab("dashboard");
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinError("");
    const { room, error } = await joinRoom(joinCode.trim(), joinDept.trim() || null);
    setJoining(false);
    if (error) {
      setJoinError(error.message || "Failed to join room");
    } else if (room) {
      setRooms((prev) => {
        if (prev.find((r) => r.id === room.id)) return prev;
        return [room, ...prev];
      });
      setSelectedRoom(room);
      setActiveTab("dashboard");
      setShowJoin(false);
      setJoinCode("");
      setJoinDept("");
    }
  }

  async function handleDelete(id) {
    const { error } = await deleteRoom(id);
    if (!error) {
      setRooms((prev) => prev.filter((r) => r.id !== id));
      if (selectedRoom?.id === id) setSelectedRoom(null);
    }
  }

  function refreshMembers() {
    if (selectedRoom) {
      getMembers(selectedRoom.id).then(({ members: m }) => setMembers(m));
    }
  }

  if (loading) {
    return (
      <div className="tt__loader-wrap">
        <div className="tt__loader" />
      </div>
    );
  }

  // Room selected -> show layout
  if (selectedRoom) {
    return (
      <div className="tt__layout">
        <Navbar session={session} profile={profile} onLogin={signInWithGoogle} onLogout={handleLogout} />
        <TeamLeftNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          room={selectedRoom}
          isAdmin={isAdmin}
          onBack={() => setSelectedRoom(null)}
        />
        <main className="tt__content">
          {activeTab === "dashboard" && (
            <TeamDashboard roomId={selectedRoom.id} isAdmin={isAdmin} userId={session.user.id} members={members} />
          )}
          {activeTab === "manage-tx" && (
            <TeamManageTransactions roomId={selectedRoom.id} isAdmin={isAdmin} userId={session.user.id} members={members} />
          )}
          {activeTab === "admin-panel" && isAdmin && (
            <AdminPanel roomId={selectedRoom.id} userId={session.user.id} members={members} onMembersChange={refreshMembers} />
          )}
          {activeTab === "manage-team" && (
            <ManageTeam
              roomId={selectedRoom.id}
              room={selectedRoom}
              isAdmin={isAdmin}
              userId={session.user.id}
              members={members}
              onMembersChange={refreshMembers}
            />
          )}
          {activeTab === "chat" && (
            <TeamChat
              roomId={selectedRoom.id}
              userId={session.user.id}
              members={members}
              profile={profile}
            />
          )}
          {activeTab === "ai-bot" && (
            <TeamAiBot roomId={selectedRoom.id} roomName={selectedRoom.name} />
          )}
        </main>
      </div>
    );
  }

  // No room selected -> room list
  return (
    <div className="tt">
      <Navbar session={session} profile={profile} onLogin={signInWithGoogle} onLogout={handleLogout} />
      <div className="tt__header">
        <div>
          <h1 className="tt__title">Team Tracking</h1>
          <p className="tt__subtitle">Create a room or join an existing one</p>
        </div>
        <div className="tt__header-actions">
          <button className="tt__join-btn" onClick={() => setShowJoin(true)}>
            Join Room
          </button>
          <button className="tt__create-btn" onClick={() => setShowCreate(true)}>
            + Create Room
          </button>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="tt__empty">
          <div className="tt__empty-icon">👥</div>
          <h3>No rooms yet</h3>
          <p>Create a new room or join one with a room code</p>
          <div className="tt__empty-actions">
            <button className="tt__join-btn" onClick={() => setShowJoin(true)}>Join Room</button>
            <button className="tt__create-btn" onClick={() => setShowCreate(true)}>+ Create Room</button>
          </div>
        </div>
      ) : (
        <div className="tt__grid">
          {rooms.map((room) => (
            <div key={room.id} className="tt__room-card" onClick={() => { setSelectedRoom(room); setActiveTab("dashboard"); }}>
              <div className="tt__room-avatar">
                {room.name.charAt(0).toUpperCase()}
              </div>
              <div className="tt__room-info">
                <h3 className="tt__room-name">{room.name}</h3>
                <span className="tt__room-code">Code: {room.room_code}</span>
                {room.admin_id === session?.user?.id && (
                  <span className="tt__room-badge">Admin</span>
                )}
                <span className="tt__room-date">
                  Created {new Date(room.created_at).toLocaleDateString()}
                </span>
              </div>
              {room.admin_id === session?.user?.id && (
                <button
                  className="tt__room-delete"
                  onClick={(e) => { e.stopPropagation(); handleDelete(room.id); }}
                  title="Delete room"
                >
                  x
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create room modal */}
      {showCreate && (
        <div className="tt__modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="tt__modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="tt__modal-title">Create New Room</h2>
            <form onSubmit={handleCreate} className="tt__modal-form">
              <div className="tt__modal-field">
                <label className="tt__modal-label">Room Name *</label>
                <input
                  className="tt__modal-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. My Startup"
                  required
                  autoFocus
                />
              </div>
              <div className="tt__modal-field">
                <label className="tt__modal-label">Description</label>
                <input
                  className="tt__modal-input"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What is this team about?"
                />
              </div>
              <div className="tt__modal-actions">
                <button type="button" className="tt__modal-cancel" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="tt__modal-submit" disabled={creating || !newName.trim()}>
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join room modal */}
      {showJoin && (
        <div className="tt__modal-overlay" onClick={() => { setShowJoin(false); setJoinError(""); }}>
          <div className="tt__modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="tt__modal-title">Join a Room</h2>
            <form onSubmit={handleJoin} className="tt__modal-form">
              <div className="tt__modal-field">
                <label className="tt__modal-label">Room Code *</label>
                <input
                  className="tt__modal-input tt__modal-input--code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABC123"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
              <div className="tt__modal-field">
                <label className="tt__modal-label">Your Department Tag</label>
                <input
                  className="tt__modal-input"
                  value={joinDept}
                  onChange={(e) => setJoinDept(e.target.value)}
                  placeholder="e.g. Design, Sales, Engineering"
                />
              </div>
              {joinError && <p className="tt__modal-error">{joinError}</p>}
              <div className="tt__modal-actions">
                <button type="button" className="tt__modal-cancel" onClick={() => { setShowJoin(false); setJoinError(""); }}>Cancel</button>
                <button type="submit" className="tt__modal-submit" disabled={joining || !joinCode.trim()}>
                  {joining ? "Joining..." : "Join"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamTracking;
