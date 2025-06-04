import { Button, Flex, Image, Box, } from "@chakra-ui/react";
import { useRecoilValue } from "recoil";
import { userAtom } from "../atoms";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { House, User, Chat, Gear, MagnifyingGlass, Bell } from "phosphor-react";
import { useBreakpointValue } from "@chakra-ui/react";
import { useState, useEffect } from "react";

const Header = () => {
	const user = useRecoilValue(userAtom);
	const location = useLocation();

	// Adjust positioning based on screen size
	const isMobile = useBreakpointValue({ base: true, md: false });

	// State for logo visibility on mobile scroll
	const [isLogoVisible, setIsLogoVisible] = useState(true);
	const [lastScrollY, setLastScrollY] = useState(0);

	// Scroll handler for mobile logo hiding
	useEffect(() => {
		if (!isMobile) return; // Only apply scroll behavior on mobile

		const handleScroll = () => {
			const currentScrollY = window.scrollY;

			// Hide logo when scrolling down past 50px, show when scrolling back up or near top
			if (currentScrollY > 50 && currentScrollY > lastScrollY) {
				// Scrolling down and past threshold
				setIsLogoVisible(false);
			} else if (currentScrollY < lastScrollY || currentScrollY <= 30) {
				// Scrolling up or near top
				setIsLogoVisible(true);
			}

			setLastScrollY(currentScrollY);
		};

		// Add scroll listener with throttling for performance
		let ticking = false;
		const throttledHandleScroll = () => {
			if (!ticking) {
				requestAnimationFrame(() => {
					handleScroll();
					ticking = false;
				});
				ticking = true;
			}
		};

		window.addEventListener('scroll', throttledHandleScroll, { passive: true });

		return () => {
			window.removeEventListener('scroll', throttledHandleScroll);
		};
	}, [isMobile, lastScrollY]);

	// Function to check if a path is active
	const isActive = (path) => {
		if (path === "/") {
			return location.pathname === "/";
		}
		if (path.startsWith("/:username")) {
			// For user profile page, check if we're on a user page but not on a specific post
			return location.pathname.match(/^\/[^/]+$/) && location.pathname !== "/search" &&
				location.pathname !== "/notifications" && location.pathname !== "/chat" &&
				location.pathname !== "/settings" && location.pathname !== "/auth";
		}
		return location.pathname.startsWith(path);
	};

	return (
		<Flex justifyContent="space-between" align="center" mt={6} mb="12">
			{/* App Logo with glow effect - Responsive positioning */}
			<Flex
				position="fixed"
				top={4}
				left={{ base: "50%", md: 8 }}
				transform={{
					base: `translateX(-50%) ${isLogoVisible || !isMobile ? 'translateY(0)' : 'translateY(-100px)'}`,
					md: "translateX(0)"
				}}
				opacity={{ base: isLogoVisible || !isMobile ? 1 : 0, md: 1 }}
				transition="all 0.3s ease-in-out"
				zIndex={1000} // Increased z-index to ensure logo is always on top
				className="mobile-logo-scroll"
			>
				<Box position="relative" display="inline-block">
					{/* Background glow effect */}
					<Box
						position="absolute"
						top="50%"
						left="50%"
						transform="translate(-50%, -50%)"
						width="40px"
						height="40px"
						borderRadius="full"
						filter="blur(15px)"
						bg="linear-gradient(45deg, rgba(0,204,133,0.3), rgba(0,121,185,0.3))"
						opacity="0.6"
						zIndex="-1"
					/>
					{/* Semi-transparent background circle for better visibility */}
					<Box
						position="absolute"
						top="50%"
						left="50%"
						transform="translate(-50%, -50%)"
						width="32px"
						height="32px"
						borderRadius="full"
						bg="rgba(8, 8, 8, 0.7)"
						zIndex="1"
					/>
					<Image
						alt="logo"
						w={8}
						src="/icon.svg"
						cursor="pointer"
						onClick={() => window.location.href = "/"}
						transition="transform 0.3s ease"
						_hover={{ transform: "scale(1.1)" }}
						position="relative"
						zIndex="2"
						style={{ filter: "drop-shadow(0 0 2px rgba(0, 0, 0, 0.5))" }} // Added shadow for better visibility
					/>
				</Box>
			</Flex>

			{/* Navigation for authenticated users */}
			{user && (
				<Flex
					direction={isMobile ? "row" : "column"}
					align="center"
					position="fixed"
					left={isMobile ? "50%" : 4}
					bottom={isMobile ? 4 : "auto"}
					top={isMobile ? "auto" : "50%"}
					transform={isMobile ? "translateX(-50%)" : "translateY(-50%)"}
					gap={6}
					className={isMobile ? "glass-navbar" : ""}
					px={isMobile ? 4 : 0}
					py={isMobile ? 3 : 0}
					borderRadius={isMobile ? "full" : "none"}
					zIndex={100}
				>
					{/* Home Button */}
					<Button
						as={RouterLink}
						to="/"
						variant="ghost"
						size="lg"
						bg={isActive("/") ? "rgba(0, 204, 133, 0.1)" : "transparent"}
						_hover={{ bg: "rgba(0, 204, 133, 0.1)" }}
						position="relative"
					>
						<House
							size={28}
							weight={isActive("/") ? "fill" : "bold"}
							color={isActive("/") ? "#00CC85" : "#616161"}
						/>
						{isActive("/") && (
							<Box className="nav-active-indicator" />
						)}
					</Button>

					{/* Search Button */}
					<Button
						as={RouterLink}
						to="/search"
						variant="ghost"
						size="lg"
						bg={isActive("/search") ? "rgba(0, 204, 133, 0.1)" : "transparent"}
						_hover={{ bg: "rgba(0, 204, 133, 0.1)" }}
						position="relative"
					>
						<MagnifyingGlass
							size={28}
							weight={isActive("/search") ? "fill" : "bold"}
							color={isActive("/search") ? "#00CC85" : "#616161"}
						/>
						{isActive("/search") && (
							<Box className="nav-active-indicator" />
						)}
					</Button>

					{/* Profile Button */}
					<Button
						as={RouterLink}
						to={`/${user.username}`}
						variant="ghost"
						size="lg"
						bg={isActive("/:username") ? "rgba(0, 204, 133, 0.1)" : "transparent"}
						_hover={{ bg: "rgba(0, 204, 133, 0.1)" }}
						position="relative"
					>
						<User
							size={28}
							weight="fill"
							color={isActive("/:username") ? "#00CC85" : "#616161"}
						/>
						{isActive("/:username") && (
							<Box className="nav-active-indicator" />
						)}
					</Button>

					{/* Notifications Button */}
					<Button
						as={RouterLink}
						to="/notifications"
						variant="ghost"
						size="lg"
						bg={isActive("/notifications") ? "rgba(0, 204, 133, 0.1)" : "transparent"}
						_hover={{ bg: "rgba(0, 204, 133, 0.1)" }}
						position="relative"
					>
						<Bell
							size={28}
							weight={isActive("/notifications") ? "fill" : "bold"}
							color={isActive("/notifications") ? "#00CC85" : "#616161"}
						/>
						{isActive("/notifications") && (
							<Box className="nav-active-indicator" />
						)}
					</Button>

					{/* Chat Button */}
					<Button
						as={RouterLink}
						to="/chat"
						variant="ghost"
						size="lg"
						bg={isActive("/chat") ? "rgba(0, 204, 133, 0.1)" : "transparent"}
						_hover={{ bg: "rgba(0, 204, 133, 0.1)" }}
						position="relative"
					>
						<Chat
							size={28}
							weight="fill"
							color={isActive("/chat") ? "#00CC85" : "#616161"}
						/>
						{isActive("/chat") && (
							<Box className="nav-active-indicator" />
						)}
					</Button>




					{/* Settings Button */}
					<Button
						as={RouterLink}
						to="/settings"
						variant="ghost"
						size="lg"
						bg={isActive("/settings") ? "rgba(0, 204, 133, 0.1)" : "transparent"}
						_hover={{ bg: "rgba(0, 204, 133, 0.1)" }}
						position="relative"
					>
						<Gear
							size={28}
							weight={isActive("/settings") ? "fill" : "bold"}
							color={isActive("/settings") ? "#00CC85" : "#616161"}
						/>
						{isActive("/settings") && (
							<Box className="nav-active-indicator" />
						)}
					</Button>
				</Flex>
			)}
		</Flex>
	);
};

export default Header;
