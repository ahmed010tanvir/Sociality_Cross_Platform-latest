import { useContext } from "react";
import { SocketContext } from "../context/SocketContext";

/**
 * Custom hook to use socket context
 * @returns {object} Socket context with socket instance and helper methods
 */
export const useSocket = () => {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error("useSocket must be used within a SocketContextProvider");
  }

  return context;
};
