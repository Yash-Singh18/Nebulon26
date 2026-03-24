import { useEffect, useState } from "react";
import { getMyAdminRequest, kickMember, requestAdmin, updateMemberDepartment } from "../../../services/supabase/teams";
import "./ManageTeam.css";

function ManageTeam({ roomId, room, isAdmin, userId, members, onMembersChange }) {
  const [requestStatus, setRequestStatus] = useState(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [editingDept, setEditingDept] = useState(null);
  const [deptValue, setDeptValue] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadRequest() {
      if (isAdmin) {
        setRequestStatus(null);
        setRequestError("");
        setRequestLoading(false);
        return;
      }

      setRequestLoading(true);
      setRequestError("");

      const { request, error } = await getMyAdminRequest(roomId);
      if (ignore) return;

      if (error) {
        setRequestError("Could not load admin request status.");
      }

      setRequestStatus(request?.status || null);
      setRequestLoading(false);
    }

    loadRequest();

    return () => {
      ignore = true;
    };
  }, [isAdmin, roomId]);

  async function handleKick(memberId, memberUserId) {
    if (memberUserId === room.admin_id) return;
    const { error } = await kickMember(roomId, memberUserId);
    if (!error) onMembersChange();
  }

  async function handleRequestAdmin() {
    setRequestLoading(true);
    setRequestError("");

    const { request, error } = await requestAdmin(roomId);

    if (error) {
      setRequestError(error.message || "Could not send admin request.");
    } else {
      setRequestStatus(request?.status || "pending");
    }

    setRequestLoading(false);
  }

  async function handleSaveDept(memberUserId) {
    const { error } = await updateMemberDepartment(roomId, memberUserId, deptValue.trim() || null);
    if (!error) {
      setEditingDept(null);
      setDeptValue("");
      onMembersChange();
    }
  }

  function startEditDept(member) {
    setEditingDept(member.user_id);
    setDeptValue(member.department || "");
  }

  return (
    <div className="mteam">
      <div className="mteam__header">
        <div>
          <h2 className="mteam__title">Team Members</h2>
          <p className="mteam__subtitle">{members.length} member{members.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="mteam__header-actions">
          <div className="mteam__room-code">
            <span className="mteam__room-code-label">Room Code</span>
            <span className="mteam__room-code-value">{room.room_code}</span>
          </div>
          {!isAdmin && requestStatus !== "pending" && requestStatus !== "approved" && (
            <button
              type="button"
              className="mteam__request-btn"
              onClick={handleRequestAdmin}
              disabled={requestLoading}
            >
              {requestLoading ? "Sending..." : "Request Admin"}
            </button>
          )}
          {!isAdmin && requestStatus === "pending" && (
            <span className="mteam__request-sent">Admin request sent!</span>
          )}
          {!isAdmin && requestStatus === "approved" && (
            <span className="mteam__request-sent">Admin request approved.</span>
          )}
          {!isAdmin && requestStatus === "rejected" && !requestError && (
            <span className="mteam__request-error">Your admin request was already reviewed.</span>
          )}
          {requestError && (
            <span className="mteam__request-error">{requestError}</span>
          )}
        </div>
      </div>

      <div className="mteam__list">
        {members.map((member) => {
          const profile = member.profiles;
          const memberIsAdmin = member.role === "admin" || member.user_id === room.admin_id;
          const isMe = member.user_id === userId;
          const canEdit = isAdmin || isMe;

          return (
            <div key={member.id} className={`mteam__member${memberIsAdmin ? " mteam__member--admin" : ""}`}>
              <div className="mteam__member-avatar">
                {(profile?.name || profile?.username || "?").charAt(0).toUpperCase()}
              </div>

              <div className="mteam__member-info">
                <div className="mteam__member-name-row">
                  <span className="mteam__member-name">
                    {profile?.name || profile?.username || "Unknown"}
                  </span>
                  {profile?.username && (
                    <span className="mteam__member-username">@{profile.username}</span>
                  )}
                  {memberIsAdmin && (
                    <span className="mteam__admin-badge">Admin</span>
                  )}
                </div>

                <div className="mteam__member-dept-row">
                  {editingDept === member.user_id ? (
                    <div className="mteam__dept-edit">
                      <input
                        className="mteam__dept-input"
                        value={deptValue}
                        onChange={(e) => setDeptValue(e.target.value)}
                        placeholder="e.g. Design, Sales"
                        autoFocus
                      />
                      <button className="mteam__dept-save" onClick={() => handleSaveDept(member.user_id)}>Save</button>
                      <button className="mteam__dept-cancel" onClick={() => setEditingDept(null)}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      {member.department ? (
                        <span className="mteam__dept-tag">{member.department}</span>
                      ) : (
                        <span className="mteam__dept-empty">No department</span>
                      )}
                      {canEdit && (
                        <button className="mteam__dept-edit-btn" onClick={() => startEditDept(member)}>
                          Edit
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {isAdmin && !memberIsAdmin && (
                <button
                  className="mteam__kick-btn"
                  onClick={() => handleKick(member.id, member.user_id)}
                  title="Remove from room"
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ManageTeam;
