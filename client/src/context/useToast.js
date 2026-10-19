import { createContext, useContext } from "react";

// toast("Added to cart") or toast("Something failed", "error")
export const ToastContext = createContext(() => {});

export const useToast = () => useContext(ToastContext);
