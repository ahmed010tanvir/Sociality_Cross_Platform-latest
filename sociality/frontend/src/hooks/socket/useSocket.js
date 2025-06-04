/**
 * Hook for socket connection
 */
import { useContext } from "react";
import { SocketContext } from "../../context/SocketContext";

export const useSocket = () => {
  const context = useContext(SocketContext);
  
  if (!context) {
    throw new Error("useSocket must be used within a SocketContextProvider");
  }
  
  return context;
};
