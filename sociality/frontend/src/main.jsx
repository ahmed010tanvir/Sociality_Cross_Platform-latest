import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { ChakraProvider } from "@chakra-ui/react";
import { ColorModeScript } from "@chakra-ui/color-mode";
import { BrowserRouter } from "react-router-dom";
import { RecoilRoot } from "recoil";
import { SocketContextProvider } from "./context/SocketContext.jsx";
import theme from "./theme";
import { setupResizeAnimationStopper } from "./utils/performanceUtils";

// Set up performance optimizations
document.addEventListener('DOMContentLoaded', () => {
  // Set up resize animation stopper to prevent layout thrashing during resize
  setupResizeAnimationStopper();
});

// Enable HMR for atoms
if (import.meta.hot) {
  import.meta.hot.accept('./atoms', () => {
    // Silent HMR for atoms
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
	// React.StrictMode renders every component twice (in the initial render), only in development.
	<React.StrictMode>
		<RecoilRoot>
			<BrowserRouter>
				<ChakraProvider theme={theme}>
					<ColorModeScript initialColorMode={theme.config.initialColorMode} />
					<SocketContextProvider>
						<App />
					</SocketContextProvider>
				</ChakraProvider>
			</BrowserRouter>
		</RecoilRoot>
	</React.StrictMode>
);
