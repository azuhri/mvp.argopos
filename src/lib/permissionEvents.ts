const PERMISSIONS_CHANGED_EVENT = "celestia:role-permissions-changed";
const PERMISSIONS_CHANGED_STORAGE_KEY = "celestia.role-permissions.changed";

/** Notify active sessions after the server has successfully saved a role's access. */
export function notifyRolePermissionsChanged(roleId: string): void {
  if (!roleId) return;
  window.dispatchEvent(new CustomEvent(PERMISSIONS_CHANGED_EVENT, { detail: roleId }));
  try {
    // The payload contains no credentials; the nonce also delivers consecutive edits.
    localStorage.setItem(PERMISSIONS_CHANGED_STORAGE_KEY, JSON.stringify({
      roleId,
      nonce: `${Date.now()}-${Math.random()}`,
    }));
  } catch {
    // Same-tab updates and periodic server refresh still work when storage is disabled.
  }
}

export function subscribeRolePermissionsChanged(onChange: (roleId: string) => void): () => void {
  const handleLocalChange = (event: Event) => {
    const roleId: unknown = (event as CustomEvent).detail;
    if (typeof roleId === "string" && roleId) onChange(roleId);
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== PERMISSIONS_CHANGED_STORAGE_KEY || !event.newValue) return;
    try {
      const payload: unknown = JSON.parse(event.newValue);
      if (payload && typeof payload === "object" && "roleId" in payload && typeof payload.roleId === "string" && payload.roleId) {
        onChange(payload.roleId);
      }
    } catch {
      // Ignore unrelated or malformed browser-storage messages.
    }
  };
  window.addEventListener(PERMISSIONS_CHANGED_EVENT, handleLocalChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(PERMISSIONS_CHANGED_EVENT, handleLocalChange);
    window.removeEventListener("storage", handleStorage);
  };
}
