import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const KEY = 'blurb-books:demo-staff-role';

const StaffRoleContext = createContext(null);

function read() {
  try {
    return window.sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Demo role switch for the librarian workspace. This is NOT authentication:
 * anyone can flip it. Real access control must be enforced by the server on
 * every staff endpoint.
 */
export function StaffRoleProvider({ children }) {
  const [isStaff, setIsStaff] = useState(read);
  const set = useCallback((value) => {
    try {
      if (value) window.sessionStorage.setItem(KEY, '1');
      else window.sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setIsStaff(value);
  }, []);
  const value = useMemo(() => ({ isStaff, enter: () => set(true), exit: () => set(false) }), [isStaff, set]);
  return <StaffRoleContext.Provider value={value}>{children}</StaffRoleContext.Provider>;
}

export function useStaffRole() {
  const value = useContext(StaffRoleContext);
  if (!value) throw new Error('useStaffRole must be used inside <StaffRoleProvider>');
  return value;
}
