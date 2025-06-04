import { Box, Container } from "@chakra-ui/react";
import { useLocation } from "react-router-dom";
import { Header } from "./components/layout";
import AppRoutes from "./routes/AppRoutes";

import useOAuthCallback from "./hooks/useOAuthCallback";
import useInitializeUser from "./hooks/useInitializeUser";


/**
 * Main application component
 * Provides the layout structure and routing for the application
 */
function App() {
	const { pathname } = useLocation();
	// Initialize user state from tab-specific storage
	useInitializeUser();

	// Handle OAuth callback on any page
	useOAuthCallback();

	return (
		<Box position={"relative"} w='full'>
			<Container maxW={pathname === "/" ? { base: "620px", md: "900px" } : "620px"}>
				{pathname !== "/auth" && pathname !== "/profile-setup" && <Header />}
				<AppRoutes />
			</Container>
		</Box>
	);
}

export default App;
