import { useState, useEffect } from "react";
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalCloseButton,
    ModalBody,
    Text,
    VStack,
    Avatar,
    HStack,
    Divider,
    Link,
    Spinner,
    Center,
    Flex,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";

const SimpleFollowList = ({ isOpen, onClose, users, title }) => {
    // Check if users is an array and has items
    const hasUsers = Array.isArray(users) && users.length > 0;
    const [isLoading, setIsLoading] = useState(true);

    // Log for debugging
    console.log(`SimpleFollowList ${title} isOpen:`, isOpen);
    console.log(`SimpleFollowList ${title} users:`, users);
    console.log(`SimpleFollowList ${title} hasUsers:`, hasUsers);

    // Add effect to simulate loading when modal opens
    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            // Simulate loading delay
            const timer = setTimeout(() => {
                setIsLoading(false);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
            <ModalOverlay />
            <ModalContent bg={"gray.dark"} color={"white"}>
                <ModalHeader>{title} List</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    {isLoading && (
                        <Center py={8}>
                            <Spinner size="xl" color="blue.500" />
                        </Center>
                    )}

                    {!isLoading && !hasUsers && (
                        <Text textAlign="center" py={4}>
                            No {title.toLowerCase()} found
                        </Text>
                    )}

                    {!isLoading && hasUsers && (
                        <VStack align="stretch" spacing={4} pb={4}>
                            {users.map((user, index) => {
                                // Skip if user is invalid
                                if (!user || typeof user !== 'object') {
                                    console.log('Invalid user:', user);
                                    return null;
                                }

                                return (
                                    <div key={user._id || index}>
                                        <HStack spacing={4} align="center">
                                            <Avatar
                                                size="md"
                                                name={user.username || 'User'}
                                                src={user.profilePic}
                                            />
                                            <Flex direction="column">
                                                <Link
                                                    as={RouterLink}
                                                    to={`/${user.username}`}
                                                    fontWeight="medium"
                                                    _hover={{ textDecoration: 'underline' }}
                                                    onClick={onClose}
                                                >
                                                    {user.username || 'Unknown User'}
                                                </Link>
                                                {user.name && (
                                                    <Text fontSize="sm" color="gray.500">
                                                        {user.name}
                                                    </Text>
                                                )}
                                            </Flex>
                                        </HStack>
                                        {index < users.length - 1 && <Divider mt={2} />}
                                    </div>
                                );
                            })}
                        </VStack>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default SimpleFollowList;
