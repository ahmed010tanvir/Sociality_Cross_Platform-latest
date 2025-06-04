import { Box, Heading, Input, Flex, Spinner, Text, VStack, InputGroup, InputLeftElement } from "@chakra-ui/react";
import { useState, useEffect } from "react";
import SuggestedUserListItem from "../components/SuggestedUserListItem"; // Import the new list item component
import useShowToast from "../hooks/useShowToast";
import { MagnifyingGlass } from "phosphor-react";
import { fetchWithSession } from "../utils/api";



const SearchPage = () => {
    const [suggestedUsers, setSuggestedUsers] = useState([]);
    const [suggestedLoading, setSuggestedLoading] = useState(true);
    const showToast = useShowToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Fetch Suggested Users
    useEffect(() => {
        const getSuggestedUsers = async () => {
            setSuggestedLoading(true);
            try {
                const res = await fetchWithSession("/api/users/suggested");
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        setSuggestedUsers(data);
                    } else {
                        showToast("Error", "Received invalid data for suggested users", "error");
                        setSuggestedUsers([]);
                    }
                } else {
                    const errorData = await res.json().catch(() => ({ error: 'Failed to fetch suggested users' }));
                    showToast("Error", errorData.error || 'Failed to fetch suggested users', "error");
                    setSuggestedUsers([]);
                }
            } catch (error) {
                showToast("Error", error.message, "error");
                setSuggestedUsers([]);
            } finally {
                setSuggestedLoading(false);
            }
        };

        getSuggestedUsers();
    }, [showToast]);

    const handleSearchChange = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        if (!query) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const res = await fetchWithSession(`/api/users/search?query=${query}`);
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data);
            } else {
                const errorData = await res.json().catch(() => ({ error: 'Failed to search users' }));
                showToast("Error", errorData.error || 'Failed to search users', "error");
                setSearchResults([]);
            }
        } catch (error) {
            showToast("Error", error.message, "error");
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <Box
            className="page-content-scroll"
            bg="transparent"
            pt={{ base: "60px", md: "20px" }} // Increased top padding on mobile for logo
        >
            <Heading as="h1" size="2xl" mb={8} textAlign={"center"}>
                Search & Discover Users
            </Heading>

            <Box
                w={["100%", "500px", "550px"]} // Increased width
                maxW="100%"
                mx="auto"
                bg="#151515"
                borderRadius="2xl"
                boxShadow="none"
                borderTop="1px solid rgba(255, 255, 255, 0.06)"
                borderLeft="1px solid rgba(255, 255, 255, 0.06)"
                borderRight="1px solid rgba(255, 255, 255, 0.06)"
                borderBottom="none"
                p={5} // Increased padding
                mb={6}
            >
                <InputGroup>
                    <InputLeftElement pointerEvents="none">
                        <MagnifyingGlass color="gray.500" />
                    </InputLeftElement>
                    <Input
                        placeholder="Search users by username or name..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        bg="transparent"
                        border="none"
                        _focus={{
                            boxShadow: "none",
                            border: "none"
                        }}
                        _hover={{
                            border: "none"
                        }}
                    />
                </InputGroup>
            </Box>

            {/* Search Results Section */}
            {searchQuery && isSearching && (
                <Box
                    w={["100%", "500px", "550px"]} // Increased width
                    maxW="100%"
                    mx="auto"
                    bg="#151515"
                    borderRadius="2xl"
                    boxShadow="none"
                    borderTop="1px solid rgba(255, 255, 255, 0.06)"
                    borderLeft="1px solid rgba(255, 255, 255, 0.06)"
                    borderRight="1px solid rgba(255, 255, 255, 0.06)"
                    borderBottom="none"
                    p={5} // Increased padding
                    mb={6}
                    display="flex"
                    flexDirection="column"
                    minH="120px" // Slightly increased height
                >
                    <Flex justify="center" align="center" flexGrow={1}>
                        <Spinner size="lg" color="whiteAlpha.700" />
                    </Flex>
                </Box>
            )}

            {searchQuery && !isSearching && searchResults.length > 0 && (
                <Box
                    w={["100%", "500px", "550px"]} // Increased width
                    maxW="100%"
                    mx="auto"
                    bg="#151515"
                    borderRadius="2xl"
                    boxShadow="none"
                    borderTop="1px solid rgba(255, 255, 255, 0.06)"
                    borderLeft="1px solid rgba(255, 255, 255, 0.06)"
                    borderRight="1px solid rgba(255, 255, 255, 0.06)"
                    borderBottom="none"
                    p={5} // Increased padding
                    mb={6}
                    display="flex"
                    flexDirection="column"
                    h="550px" // Further increased height for more content
                >
                    <Heading as="h2" size="lg" mb={5} textAlign={"center"} flexShrink={0}>
                        Search Results
                    </Heading>
                    <Box
                        overflowY="scroll" // Force scroll instead of auto
                        flexGrow={1}
                        h="calc(100% - 60px)" // Subtract the heading height (adjusted for larger heading)
                        className="always-show-scrollbar" // Add a class for custom styling
                        css={{
                            '&::-webkit-scrollbar': {
                                width: '8px', // Wider scrollbar
                                display: 'block', // Always show scrollbar
                            },
                            '&::-webkit-scrollbar-track': {
                                background: '#1a1a1a', // Slightly visible track
                                display: 'block', // Always show track
                            },
                            '&::-webkit-scrollbar-thumb': {
                                background: 'rgba(255, 255, 255, 0.3)', // More visible thumb
                                borderRadius: '4px',
                                minHeight: '30px', // Ensure thumb is visible
                            },
                            '&::-webkit-scrollbar-thumb:hover': {
                                background: 'rgba(255, 255, 255, 0.5)', // Even more visible on hover
                            },
                            scrollbarWidth: 'thin',
                            scrollbarColor: 'rgba(255, 255, 255, 0.3) #1a1a1a',
                            // Firefox specific
                            scrollbarGutter: 'stable',
                        }}
                    >
                        <VStack spacing={6} align="stretch" pb={6}>
                            {/* Render actual search results */}
                            {searchResults.map((user) => (
                                <SuggestedUserListItem key={user._id} user={user} />
                            ))}

                            {/* Add padding at the bottom for spacing */}
                            <Box h="20px"></Box>
                        </VStack>
                    </Box>
                </Box>
            )}

            {searchQuery && !isSearching && searchResults.length === 0 && (
                <Box
                    w={["100%", "500px", "550px"]} // Increased width
                    maxW="100%"
                    mx="auto"
                    bg="#151515"
                    borderRadius="2xl"
                    boxShadow="none"
                    borderTop="1px solid rgba(255, 255, 255, 0.06)"
                    borderLeft="1px solid rgba(255, 255, 255, 0.06)"
                    borderRight="1px solid rgba(255, 255, 255, 0.06)"
                    borderBottom="none"
                    p={5} // Increased padding
                    mb={6}
                    display="flex"
                    flexDirection="column"
                    minH="120px" // Slightly increased height
                >
                    <Flex align="center" justify="center" flexGrow={1}>
                        <Text textAlign={"center"}>No users found matching &ldquo;{searchQuery}&rdquo;</Text>
                    </Flex>
                </Box>
            )}

            {/* Suggested Users Section */}
            {!searchQuery && (
                <Box
                    w={["100%", "500px", "550px"]} // Increased width
                    maxW="100%"
                    mx="auto"
                    bg="#151515"
                    borderRadius="2xl"
                    boxShadow="none"
                    borderTop="1px solid rgba(255, 255, 255, 0.06)"
                    borderLeft="1px solid rgba(255, 255, 255, 0.06)"
                    borderRight="1px solid rgba(255, 255, 255, 0.06)"
                    borderBottom="none"
                    p={5} // Increased padding
                    mb={6}
                    display="flex"
                    flexDirection="column"
                    h="550px" // Further increased height for more content
                >
                    <Heading as="h2" size="lg" mb={5} textAlign={"center"} flexShrink={0}>
                        Suggested Users
                    </Heading>
                    {suggestedLoading ? (
                        <Flex justify="center" p={4} flexGrow={1}>
                            <Spinner size="lg" />
                        </Flex>
                    ) : suggestedUsers.length === 0 ? (
                        <Text textAlign={"center"} p={4} flexGrow={1}>No suggested users available.</Text>
                    ) : (
                        <Box
                            overflowY="scroll" // Force scroll instead of auto
                            flexGrow={1}
                            h="calc(100% - 60px)" // Subtract the heading height (adjusted for larger heading)
                            className="always-show-scrollbar" // Add a class for custom styling
                            css={{
                                '&::-webkit-scrollbar': {
                                    width: '8px', // Wider scrollbar
                                    display: 'block', // Always show scrollbar
                                },
                                '&::-webkit-scrollbar-track': {
                                    background: '#1a1a1a', // Slightly visible track
                                    display: 'block', // Always show track
                                },
                                '&::-webkit-scrollbar-thumb': {
                                    background: 'rgba(255, 255, 255, 0.3)', // More visible thumb
                                    borderRadius: '4px',
                                    minHeight: '30px', // Ensure thumb is visible
                                },
                                '&::-webkit-scrollbar-thumb:hover': {
                                    background: 'rgba(255, 255, 255, 0.5)', // Even more visible on hover
                                },
                                scrollbarWidth: 'thin',
                                scrollbarColor: 'rgba(255, 255, 255, 0.3) #1a1a1a',
                                // Firefox specific
                                scrollbarGutter: 'stable',
                            }}
                        >
                            <VStack spacing={6} align="stretch" pb={6}>
                                {/* Render actual suggested users */}
                                {suggestedUsers.map((user) => (
                                    <SuggestedUserListItem key={user._id} user={user} />
                                ))}

                                {/* Add padding at the bottom for spacing */}
                                <Box h="20px"></Box>
                            </VStack>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
};

export default SearchPage;
